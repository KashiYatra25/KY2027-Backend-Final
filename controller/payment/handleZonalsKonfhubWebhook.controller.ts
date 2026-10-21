import type { Request, Response } from "express";
import { prisma } from "@root/prisma.js";
import { ZonalUserCollegeModel, PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// ZONALS KONFHUB WEBHOOK HANDLER
// 
// Same pattern as main KonfHub webhook:
// - Keywords in env map ticket name to college + pass type
// - Each college has its own SINGLE and MULTI keywords
// ═══════════════════════════════════════════════════════════════════

// Parse a comma-separated keyword env var into a lowercased string[]
function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
}

// College keyword configs from env
const RGIPT_SINGLE_KEYWORDS = parseKeywords(env.KONFHUB_ZONALS_RGIPT_SINGLE_KEYWORDS);
const RGIPT_MULTI_KEYWORDS = parseKeywords(env.KONFHUB_ZONALS_RGIPT_MULTI_KEYWORDS);

/**
 * Attendee data extracted from KonfHub webhook
 */
interface ZonalAttendee {
  bookingId: string;
  name: string;
  email: string;
  phone: string | null;
  kyId: string | null;
  ticketName: string;
  ticketPrice: number;
  amountPaid: number;
  currency: string;
  paymentId: string | null;
  ticketUrl: string | null;
  invoiceUrl: string | null;
}

/**
 * Map KonfHub ticket name to college and pass type
 * Same pattern as main webhook's mapTicketToPassDetails
 */
function mapTicketToZonalDetails(ticketName: string): { college: string; passType: "SINGLE_EVENT" | "MULTI_EVENT" } | null {
  const ticketLower = ticketName.toLowerCase();

  // RGIPT
  if (RGIPT_MULTI_KEYWORDS.some((kw) => ticketLower.includes(kw))) {
    return { college: "rgipt", passType: "MULTI_EVENT" };
  }
  if (RGIPT_SINGLE_KEYWORDS.some((kw) => ticketLower.includes(kw))) {
    return { college: "rgipt", passType: "SINGLE_EVENT" };
  }

  return null;
}

/**
 * Calculate event limit based on pass type
 * -1 = unlimited, 1 = single event
 */
function getEventLimit(passType: "SINGLE_EVENT" | "MULTI_EVENT"): number {
  return passType === "MULTI_EVENT" ? -1 : 1;
}

/**
 * Find user by KY ID or email
 */
async function findUserByAttendee(attendee: ZonalAttendee) {
  // Try matching by KY_ID first
  if (attendee.kyId) {
    const userByKyId = await prisma.user.findUnique({
      where: { kyId: attendee.kyId },
      select: { id: true, email: true },
    });
    if (userByKyId) {
      return { user: userByKyId, matchedBy: "ky_id" as const };
    }
    
    logger.warn({
      msg: "Zonals webhook: attendee provided invalid KY_ID",
      kyId: attendee.kyId,
      attendeeEmail: attendee.email,
    });
  }

  // Fallback to email match
  const userByEmail = await prisma.user.findUnique({
    where: { email: attendee.email.toLowerCase() },
    select: { id: true, email: true },
  });
  
  if (userByEmail) {
    return { user: userByEmail, matchedBy: "email" as const };
  }

  return null;
}

/**
 * Handle registration event - ATOMIC VERSION
 * Uses findOneAndUpdate to prevent duplicate passes from concurrent webhooks.
 */
async function handleRegistration(
  attendee: ZonalAttendee,
  college: string,
  passType: "SINGLE_EVENT" | "MULTI_EVENT",
  webhookId: string,
  eventAt: Date
) {
  const logContext = {
    webhookId,
    bookingId: attendee.bookingId,
    attendeeEmail: attendee.email,
    ticketName: attendee.ticketName,
    college,
    passType,
  };

  const eventLimit = getEventLimit(passType);

  // Build the pass object
  const newPass = {
    passType,
    amount: attendee.amountPaid,
    paymentStatus: "completed" as const,
    paymentId: attendee.bookingId,
    paymentSource: "konfhub" as const,
    ticketUrl: attendee.ticketUrl,
    invoiceUrl: attendee.invoiceUrl,
    purchasedAt: eventAt,
  };

  // Find user
  const matchResult = await findUserByAttendee(attendee);
  
  if (!matchResult) {
    logger.warn({
      msg: "Zonals webhook: could not match attendee to user",
      ...logContext,
      kyId: attendee.kyId,
    });
    
    // Store with unmatched prefix for manual review
    // Use atomic update to prevent duplicates even for unmatched users
    const userId = `unmatched:${attendee.email}`;
    
    const result = await ZonalUserCollegeModel.findOneAndUpdate(
      { 
        userId, 
        collegeSlug: college,
        "passes.paymentId": { $ne: attendee.bookingId } // Only if this payment not already recorded
      },
      {
        $push: { passes: newPass },
        $max: { eventLimit: eventLimit },
      },
      { upsert: true, new: true }
    );

    // Check if pass was actually added (idempotency check)
    const passWasAdded = result.passes.some(p => p.paymentId === attendee.bookingId);
    if (!passWasAdded) {
      // Document existed but our pass wasn't added - must be a duplicate
      // Try to find if it already exists
      const existingDoc = await ZonalUserCollegeModel.findOne({
        "passes.paymentId": attendee.bookingId
      });
      if (existingDoc) {
        logger.info({ msg: "Zonals webhook: booking already processed (unmatched)", ...logContext });
        return { success: true, skipped: true, reason: "already_processed" };
      }
    }

    // Also create a Purchase record for unmatched users (for admin visibility)
    // Use findOneAndUpdate for idempotency
    await PurchaseModel.findOneAndUpdate(
      { "konfhub.bookingId": attendee.bookingId },
      {
        $setOnInsert: {
          userId: userId, // "unmatched:email@example.com"
          source: "konfhub",
          passType: `Zonals ${college.toUpperCase()} - ${passType === "MULTI_EVENT" ? "Multi Event" : "Single Event"}`,
          amountPaid: Math.round(attendee.amountPaid * 100), // Convert to paise
          currency: attendee.currency,
          status: "VERIFIED",
          benefits: {
            festivalEntry: true,
            allDaysAccess: passType === "MULTI_EVENT",
          },
          konfhub: {
            webhookId,
            bookingId: attendee.bookingId,
            attendeeEmail: attendee.email,
            attendeeName: attendee.name,
            attendeePhone: attendee.phone,
            ticketName: attendee.ticketName,
            ticketPrice: attendee.ticketPrice,
            paymentId: attendee.paymentId,
            ticketUrl: attendee.ticketUrl,
            invoiceUrl: attendee.invoiceUrl,
            registeredAt: eventAt,
            matchedBy: "unmatched",
          },
          userSnapshot: {
            email: attendee.email,
            name: attendee.name,
            phone: attendee.phone,
            kyId: attendee.kyId,
          },
        },
      },
      { upsert: true }
    );
    
    return { success: true, matched: false, passType };
  }

  const { user, matchedBy } = matchResult;

  // ATOMIC upsert - prevents duplicate passes from concurrent webhooks
  // The filter includes a check that this paymentId doesn't already exist
  const result = await ZonalUserCollegeModel.findOneAndUpdate(
    { 
      userId: user.id, 
      collegeSlug: college,
      "passes.paymentId": { $ne: attendee.bookingId } // Only if this payment not already recorded
    },
    {
      $push: { passes: newPass },
      // Set event limit - use $max so MULTI (-1) always wins, but don't downgrade
      // If currently -1 (unlimited), keep it. If currently 0, set to eventLimit.
      // If currently 1 and new is -1, set to -1.
      $max: { eventLimit: eventLimit },
      $setOnInsert: {
        registeredEvents: [],
        userSnapshot: {
          email: user.email,
          name: attendee.name,
          phone: attendee.phone,
          kyId: attendee.kyId,
        },
      },
    },
    { 
      upsert: true, 
      new: true,
    }
  );

  // Check if pass was actually added by looking for our paymentId
  const passWasAdded = result.passes.some(p => p.paymentId === attendee.bookingId);
  
  if (!passWasAdded) {
    // Our pass wasn't in the result - it was already there (idempotent)
    // This happens when: doc exists, already has this paymentId, so filter didn't match
    // and upsert created nothing (no match + upsert with $ne doesn't insert)
    
    // Actually check if it exists elsewhere
    const existingDoc = await ZonalUserCollegeModel.findOne({
      "passes.paymentId": attendee.bookingId
    });
    
    if (existingDoc) {
      logger.info({ msg: "Zonals webhook: booking already processed", ...logContext });
      return { success: true, skipped: true, reason: "already_processed" };
    }
    
    // Edge case: filter didn't match but pass also doesn't exist anywhere
    // This shouldn't happen with correct logic, but handle it
    logger.warn({ 
      msg: "Zonals webhook: unexpected state - pass not added but not found", 
      ...logContext 
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE PURCHASE RECORD
  // So zonals purchases appear in the user's purchase history alongside
  // main KY passes. Uses findOneAndUpdate for idempotency.
  // ═══════════════════════════════════════════════════════════════════
  await PurchaseModel.findOneAndUpdate(
    { "konfhub.bookingId": attendee.bookingId },
    {
      $setOnInsert: {
        userId: user.id,
        source: "konfhub",
        passType: `Zonals ${college.toUpperCase()} - ${passType === "MULTI_EVENT" ? "Multi Event" : "Single Event"}`,
        amountPaid: Math.round(attendee.amountPaid * 100), // Convert to paise
        currency: attendee.currency,
        status: "VERIFIED",
        benefits: {
          festivalEntry: true,
          allDaysAccess: passType === "MULTI_EVENT",
        },
        konfhub: {
          webhookId,
          bookingId: attendee.bookingId,
          attendeeEmail: attendee.email,
          attendeeName: attendee.name,
          attendeePhone: attendee.phone,
          ticketName: attendee.ticketName,
          ticketPrice: attendee.ticketPrice,
          paymentId: attendee.paymentId,
          ticketUrl: attendee.ticketUrl,
          invoiceUrl: attendee.invoiceUrl,
          registeredAt: eventAt,
          matchedBy,
        },
        userSnapshot: {
          email: user.email,
          name: attendee.name,
          phone: attendee.phone,
          kyId: attendee.kyId,
        },
      },
    },
    { upsert: true }
  );

  logger.info({
    msg: "Zonals webhook: pass added successfully",
    userId: user.id,
    matchedBy,
    eventLimit: result.eventLimit,
    totalPasses: result.passes.length,
    ...logContext,
  });

  return { success: true, matched: true, userId: user.id, matchedBy, passType };
}

/**
 * Main webhook handler
 */
export const handleZonalsKonfhubWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  // Extract basic info for logging (no PII)
  const rawBody = req.body as Record<string, unknown>;
  const webhookId = String(rawBody.Id || "");
  const rawEventType = String(rawBody["Event Type"] || "").toLowerCase().trim();
  
  logger.info({ 
    msg: "Zonals KonfHub webhook received",
    webhookId,
    eventType: rawEventType,
  });
  
  try {
    const eventAt = new Date(Number(rawBody["Event At"]) || Date.now());
    
    // Extract attendee details - same structure as main webhook
    const data = rawBody.Data as Record<string, unknown> | undefined;
    const details = (data?.["Attendee Details"] || {}) as Record<string, unknown>;
    const ticketDetails = (details["Ticket Details"] || {}) as Record<string, unknown>;
    const amountDetails = (details["Amount Details"] || {}) as Record<string, unknown>;
    
    const attendee: ZonalAttendee = {
      bookingId: String(details["Booking Id"] || ""),
      name: String(details["Name"] || ""),
      email: String(details["Email Address"] || ""),
      phone: details["Phone Number"] ? String(details["Phone Number"]) : null,
      kyId: (() => {
        const raw = details[env.KONFHUB_KY_ID_FIELD];
        return raw && String(raw).trim() ? String(raw).trim() : null;
      })(),
      ticketName: String(ticketDetails["Ticket Name"] || ""),
      ticketPrice: Number(ticketDetails["Ticket Price"] || 0),
      amountPaid: Number(amountDetails["Amount Paid"] || 0),
      currency: String(amountDetails["Currency"] || "INR"),
      paymentId: String(details["payment_id"] || amountDetails["Payment ID"] || "") || null,
      ticketUrl: details["Ticket URL"] ? String(details["Ticket URL"]) : null,
      invoiceUrl: details["Invoice URL"] ? String(details["Invoice URL"]) : null,
    };

    logger.info({
      msg: "Zonals webhook processing",
      webhookId,
      eventType: rawEventType,
      bookingId: attendee.bookingId,
      ticketName: attendee.ticketName,
    });

    // Only process registration events
    if (rawEventType !== "registration") {
      logger.info({ msg: "Zonals webhook: ignoring event type", webhookId, rawEventType });
      res.status(200).json({ webhookId, status: "ignored", event_type: rawEventType });
      return;
    }

    // Map ticket name to college + pass type (same pattern as main webhook)
    const zonalDetails = mapTicketToZonalDetails(attendee.ticketName);
    
    if (!zonalDetails) {
      logger.error({
        msg: "Zonals webhook: unknown ticket name, cannot determine college/pass type",
        webhookId,
        ticketName: attendee.ticketName,
        hint: "Add keywords to KONFHUB_ZONALS_<COLLEGE>_SINGLE_KEYWORDS or KONFHUB_ZONALS_<COLLEGE>_MULTI_KEYWORDS env vars",
      });
      res.status(400).json({ 
        webhookId,
        success: false,
        error: "Unknown ticket name - college/pass type mapping not found",
        ticketName: attendee.ticketName,
      });
      return;
    }

    const { college, passType } = zonalDetails;
    
    const result = await handleRegistration(attendee, college, passType, webhookId, eventAt);

    logger.info({
      msg: "Zonals KonfHub webhook processed",
      webhookId,
      college,
      passType,
      result,
    });

    res.status(200).json({
      webhookId,
      college,
      passType,
      ...result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    logger.error({
      msg: "Zonals KonfHub webhook: error processing",
      webhookId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 500 for transient errors so KonfHub retries
    // The atomic update prevents duplicate processing
    res.status(500).json({
      webhookId,
      success: false,
      error: "Internal server error - please retry",
    });
  }
};
