import type { Request, Response } from "express";
import { prisma } from "@root/prisma.js";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/index.js";
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

// Add more colleges as needed:
// const NITP_SINGLE_KEYWORDS = parseKeywords(env.KONFHUB_ZONALS_NITP_SINGLE_KEYWORDS);
// const NITP_MULTI_KEYWORDS = parseKeywords(env.KONFHUB_ZONALS_NITP_MULTI_KEYWORDS);

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

  // Add more colleges as needed:
  // if (NITP_MULTI_KEYWORDS.some((kw) => ticketLower.includes(kw))) {
  //   return { college: "nit-patna", passType: "MULTI_EVENT" };
  // }
  // if (NITP_SINGLE_KEYWORDS.some((kw) => ticketLower.includes(kw))) {
  //   return { college: "nit-patna", passType: "SINGLE_EVENT" };
  // }

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
 * Handle registration event
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

  // Check for duplicate
  const existingPass = await ZonalUserCollegeModel.findOne({
    "passes.paymentId": attendee.bookingId,
  });

  if (existingPass) {
    logger.info({ msg: "Zonals webhook: booking already processed", ...logContext });
    return { success: true, skipped: true, reason: "already_processed" };
  }

  const eventLimit = getEventLimit(passType);

  // Find user
  const matchResult = await findUserByAttendee(attendee);
  
  if (!matchResult) {
    logger.warn({
      msg: "Zonals webhook: could not match attendee to user",
      ...logContext,
      kyId: attendee.kyId,
    });
    
    // Store with unmatched prefix for manual review
    const userId = `unmatched:${attendee.email}`;
    
    await ZonalUserCollegeModel.findOneAndUpdate(
      { userId, collegeSlug: college },
      {
        $push: {
          passes: {
            passType,
            amount: attendee.amountPaid,
            paymentStatus: "completed",
            paymentId: attendee.bookingId,
            paymentSource: "konfhub",
            ticketUrl: attendee.ticketUrl,
            invoiceUrl: attendee.invoiceUrl,
            purchasedAt: eventAt,
          },
        },
        $max: { eventLimit: eventLimit },
      },
      { upsert: true, new: true }
    );
    
    return { success: true, matched: false, passType };
  }

  const { user, matchedBy } = matchResult;

  // Upsert the zonal user college document
  const existingDoc = await ZonalUserCollegeModel.findOne({ 
    userId: user.id, 
    collegeSlug: college 
  });

  if (existingDoc) {
    // Add new pass to existing document
    existingDoc.passes.push({
      passType,
      amount: attendee.amountPaid,
      paymentStatus: "completed",
      paymentId: attendee.bookingId,
      paymentSource: "konfhub",
      ticketUrl: attendee.ticketUrl,
      invoiceUrl: attendee.invoiceUrl,
      purchasedAt: eventAt,
    });

    // Update event limit (multi takes precedence)
    if (passType === "MULTI_EVENT" || existingDoc.eventLimit === -1) {
      existingDoc.eventLimit = -1;
    } else if (existingDoc.eventLimit === 0) {
      existingDoc.eventLimit = 1;
    }

    await existingDoc.save();

    logger.info({
      msg: "Zonals webhook: updated existing document",
      userId: user.id,
      matchedBy,
      newEventLimit: existingDoc.eventLimit,
      totalPasses: existingDoc.passes.length,
      ...logContext,
    });
  } else {
    // Create new document
    await ZonalUserCollegeModel.create({
      userId: user.id,
      collegeSlug: college,
      passes: [{
        passType,
        amount: attendee.amountPaid,
        paymentStatus: "completed",
        paymentId: attendee.bookingId,
        paymentSource: "konfhub",
        ticketUrl: attendee.ticketUrl,
        invoiceUrl: attendee.invoiceUrl,
        purchasedAt: eventAt,
      }],
      eventLimit,
      registeredEvents: [],
    });

    logger.info({
      msg: "Zonals webhook: created new document",
      userId: user.id,
      matchedBy,
      eventLimit,
      ...logContext,
    });
  }

  return { success: true, matched: true, userId: user.id, matchedBy, passType };
}

/**
 * Main webhook handler
 */
export const handleZonalsKonfhubWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  logger.info({ 
    msg: "Zonals KonfHub webhook received - raw body",
    body: JSON.stringify(req.body, null, 2),
  });
  
  try {
    // Parse raw body - same structure as main KonfHub webhook
    const rawBody = req.body as Record<string, unknown>;
    
    const webhookId = String(rawBody.Id || "");
    const rawEventType = String(rawBody["Event Type"] || "").toLowerCase().trim();
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
      msg: "Zonals KonfHub webhook received",
      webhookId,
      rawEventType,
      bookingId: attendee.bookingId,
      attendeeEmail: attendee.email,
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
    logger.error({
      msg: "Zonals KonfHub webhook: error processing",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 200 to prevent KonfHub from retrying (we logged the error)
    res.status(200).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
