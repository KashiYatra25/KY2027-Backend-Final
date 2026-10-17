import type { Request, Response } from "express";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { queuePassesInvoiceEmail } from "@services/queue/emailQueue.service.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// KONFHUB WEBHOOK HANDLER
// Receives notifications from KonfHub for pass purchases
// ═══════════════════════════════════════════════════════════════════

/**
 * Attendee data extracted from KonfHub webhook
 */
export interface KonfHubAttendee {
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
  couponCode: string | null;
  teamName: string | null;
  parentBookingId: string | null;
  buyerEmail: string | null;
}

/**
 * Map KonfHub ticket name to our pass type and benefits
 */
function mapTicketToPassDetails(ticketName: string) {
  const ticketLower = ticketName.toLowerCase();
  
  // Map based on ticket name patterns
  if (ticketLower.includes("darbar") || ticketLower.includes("vip") || ticketLower.includes("platinum")) {
    return {
      passType: "Darbar Pass",
      benefits: {
        festivalEntry: true,
        allDaysAccess: true,
        proNiteAccess: true,
        proNiteSeating: "vip" as const,
        welcomeKit: true,
        tshirt: true,
        merchandise: true,
        mealsIncluded: 6,
        refreshments: true,
        backstageAccess: true,
        workshopAccess: true,
        meetAndGreet: true,
      },
    };
  } else if (ticketLower.includes("swarnim") || ticketLower.includes("gold")) {
    return {
      passType: "Swarnim Pass",
      benefits: {
        festivalEntry: true,
        allDaysAccess: true,
        proNiteAccess: true,
        proNiteSeating: "priority" as const,
        welcomeKit: true,
        tshirt: true,
        mealsIncluded: 3,
        refreshments: true,
        workshopAccess: true,
      },
    };
  } else {
    // Default: Yatri Pass (includes "regular", "basic", "yatri", etc.)
    return {
      passType: "Yatri Pass",
      benefits: {
        festivalEntry: true,
        allDaysAccess: true,
        proNiteAccess: true,
        proNiteSeating: "general" as const,
        welcomeKit: true,
      },
    };
  }
}

/**
 * Find our user from KonfHub attendee data
 * Priority: 1. KY_ID (custom form field) 2. email match
 */
async function findUserByAttendee(attendee: KonfHubAttendee) {
  // Try matching by KY_ID first (custom form field)
  if (attendee.kyId) {
    const userByKyId = await prisma.user.findUnique({
      where: { kyId: attendee.kyId },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, kyId: true, college: true },
    });
    if (userByKyId) {
      return { user: userByKyId, matchedBy: "ky_id" as const };
    }
    
    logger.warn({
      msg: "KonfHub attendee provided invalid KY_ID",
      kyId: attendee.kyId,
      attendeeEmail: attendee.email,
    });
  }

  // Fallback to email match
  const userByEmail = await prisma.user.findUnique({
    where: { email: attendee.email.toLowerCase() },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, kyId: true, college: true },
  });
  
  if (userByEmail) {
    return { user: userByEmail, matchedBy: "email" as const };
  }

  return null;
}

/**
 * Handle registration event
 * Creates purchase record and marks user as paid
 */
async function handleRegistration(
  attendee: KonfHubAttendee,
  webhookId: string,
  eventAt: Date,
  rawPayload: unknown
) {
  const logContext = {
    webhookId,
    bookingId: attendee.bookingId,
    attendeeEmail: attendee.email,
    ticketName: attendee.ticketName,
  };

  // Check if we already processed this booking
  const existingPurchase = await PurchaseModel.findOne({
    "konfhub.bookingId": attendee.bookingId,
  });
  
  if (existingPurchase) {
    logger.info({ msg: "KonfHub webhook: booking already processed", ...logContext });
    return { success: true, skipped: true, reason: "already_processed" };
  }

  // Map ticket name to pass details
  const { passType, benefits } = mapTicketToPassDetails(attendee.ticketName);

  // Find matching user in our system
  const matchResult = await findUserByAttendee(attendee);
  
  if (!matchResult) {
    logger.warn({
      msg: "KonfHub webhook: could not match attendee to user",
      ...logContext,
      kyId: attendee.kyId,
    });
    
    // Still create purchase record for manual review
    await PurchaseModel.create({
      userId: "UNMATCHED",
      source: "konfhub",
      passType,
      amountPaid: attendee.amountPaid,
      currency: attendee.currency,
      benefits,
      status: "VERIFIED", // KonfHub payment is already verified
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
        couponCode: attendee.couponCode,
        teamName: attendee.teamName,
        registeredAt: eventAt,
        matchedBy: "unmatched",
        rawPayload,
      },
      userSnapshot: {
        email: attendee.email,
        name: attendee.name,
        phone: attendee.phone,
      },
    });
    
    return { success: true, matched: false, passType };
  }

  const { user, matchedBy } = matchResult;

  // Create purchase record
  await PurchaseModel.create({
    userId: user.id,
    source: "konfhub",
    passType,
    amountPaid: attendee.amountPaid,
    currency: attendee.currency,
    benefits,
    status: "VERIFIED",
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
      couponCode: attendee.couponCode,
      teamName: attendee.teamName,
      registeredAt: eventAt,
      matchedBy,
      rawPayload,
    },
    userSnapshot: {
      email: user.email,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || attendee.name,
      phone: user.phone || attendee.phone,
      kyId: user.kyId,
      college: user.college,
    },
  });

  // Mark user as paid
  await prisma.user.update({
    where: { id: user.id },
    data: { isPaidUser: true },
  });

  // Queue confirmation email
  const userName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || attendee.name;
  await queuePassesInvoiceEmail({
    userName,
    email: user.email,
    invoiceUrl: attendee.invoiceUrl || "",
    orderDetails: {
      passType,
      ticketName: attendee.ticketName,
      ticketPrice: attendee.ticketPrice,
      amountPaid: attendee.amountPaid,
      attendeeName: attendee.name,
      registeredAt: eventAt.toISOString(),
      bookingId: attendee.bookingId,
      ticketUrl: attendee.ticketUrl,
    },
  });

  logger.info({
    msg: "KonfHub webhook: registration successful",
    userId: user.id,
    matchedBy,
    passType,
    amountPaid: attendee.amountPaid,
    ...logContext,
  });

  return { success: true, matched: true, userId: user.id, matchedBy, passType };
}

/**
 * Handle cancel event
 * Updates purchase status and potentially revokes paid status
 */
async function handleCancellation(attendee: KonfHubAttendee, webhookId: string, eventAt: Date) {
  const logContext = {
    webhookId,
    bookingId: attendee.bookingId,
    attendeeEmail: attendee.email,
  };

  const purchase = await PurchaseModel.findOneAndUpdate(
    { "konfhub.bookingId": attendee.bookingId },
    {
      status: "CANCELLED",
      "konfhub.cancelledAt": eventAt,
    },
    { new: true }
  );

  if (!purchase) {
    logger.warn({ msg: "KonfHub webhook: cancellation for unknown booking", ...logContext });
    return { success: false, error: "Purchase not found" };
  }

  // Check if user has any other active purchases
  if (purchase.userId !== "UNMATCHED") {
    const otherActivePurchases = await PurchaseModel.countDocuments({
      userId: purchase.userId,
      status: { $in: ["VERIFIED", "CHECKED_IN"] },
      _id: { $ne: purchase._id },
    });

    // If no other active purchases, revoke paid status
    if (otherActivePurchases === 0) {
      await prisma.user.update({
        where: { id: purchase.userId },
        data: { isPaidUser: false },
      });
      logger.info({
        msg: "KonfHub webhook: revoked paid status (no active purchases)",
        userId: purchase.userId,
        ...logContext,
      });
    }
  }

  logger.info({ msg: "KonfHub webhook: cancellation processed", ...logContext });
  return { success: true };
}

/**
 * Handle check_in event
 */
async function handleCheckIn(attendee: KonfHubAttendee, webhookId: string, eventAt: Date) {
  const purchase = await PurchaseModel.findOneAndUpdate(
    { "konfhub.bookingId": attendee.bookingId },
    {
      status: "CHECKED_IN",
      "konfhub.checkedInAt": eventAt,
      "checkIn.checkedInAt": eventAt,
    },
    { new: true }
  );

  if (!purchase) {
    logger.warn({
      msg: "KonfHub webhook: check-in for unknown booking",
      webhookId,
      bookingId: attendee.bookingId,
    });
    return { success: false, error: "Purchase not found" };
  }

  logger.info({
    msg: "KonfHub webhook: check-in processed",
    webhookId,
    bookingId: attendee.bookingId,
    userId: purchase.userId,
  });

  return { success: true };
}

/**
 * Handle check_out event
 */
async function handleCheckOut(attendee: KonfHubAttendee, webhookId: string, eventAt: Date) {
  const purchase = await PurchaseModel.findOneAndUpdate(
    { "konfhub.bookingId": attendee.bookingId },
    {
      status: "CHECKED_OUT",
      "konfhub.checkedOutAt": eventAt,
      "checkIn.checkedOutAt": eventAt,
    },
    { new: true }
  );

  if (!purchase) {
    logger.warn({
      msg: "KonfHub webhook: check-out for unknown booking",
      webhookId,
      bookingId: attendee.bookingId,
    });
    return { success: false, error: "Purchase not found" };
  }

  logger.info({
    msg: "KonfHub webhook: check-out processed",
    webhookId,
    bookingId: attendee.bookingId,
    userId: purchase.userId,
  });

  return { success: true };
}

/**
 * Main webhook handler
 */
export const handleKonfhubWebhook = async (
  req: Request,
  res: Response
) => {
  try {
    // Parse raw body
    const rawBody = req.body as Record<string, unknown>;
    
    const webhookId = String(rawBody.Id || "");
    const rawEventType = String(rawBody["Event Type"] || "").toLowerCase().trim();
    const eventAt = new Date(Number(rawBody["Event At"]) || Date.now());
    
    // Normalize event type
    let eventType: "registration" | "cancel" | "check_in" | "check_out" | "unknown" = "unknown";
    if (rawEventType === "registration") eventType = "registration";
    else if (rawEventType === "cancel" || rawEventType === "cancelled") eventType = "cancel";
    else if (rawEventType === "check_in" || rawEventType === "checkin") eventType = "check_in";
    else if (rawEventType === "check_out" || rawEventType === "checkout") eventType = "check_out";
    
    // Extract attendee details
    const data = rawBody.Data as Record<string, unknown> | undefined;
    const details = (data?.["Attendee Details"] || {}) as Record<string, unknown>;
    const ticketDetails = (details["Ticket Details"] || {}) as Record<string, unknown>;
    const amountDetails = (details["Amount Details"] || {}) as Record<string, unknown>;
    const couponDetails = (details["Coupon Details"] || {}) as Record<string, unknown>;
    
    const attendee: KonfHubAttendee = {
      bookingId: String(details["Booking Id"] || ""),
      name: String(details["Name"] || ""),
      email: String(details["Email Address"] || ""),
      phone: details["Phone Number"] ? String(details["Phone Number"]) : null,
      kyId: details["KY_ID"] && String(details["KY_ID"]).trim() ? String(details["KY_ID"]).trim() : null,
      ticketName: String(ticketDetails["Ticket Name"] || ""),
      ticketPrice: Number(ticketDetails["Ticket Price"] || 0),
      amountPaid: Number(amountDetails["Amount Paid"] || 0),
      currency: String(amountDetails["Currency"] || "INR"),
      paymentId: String(details["payment_id"] || amountDetails["Payment ID"] || "") || null,
      ticketUrl: details["Ticket URL"] ? String(details["Ticket URL"]) : null,
      invoiceUrl: details["Invoice URL"] ? String(details["Invoice URL"]) : null,
      couponCode: couponDetails["Coupon Code"] ? String(couponDetails["Coupon Code"]) : null,
      teamName: details["Team Name"] ? String(details["Team Name"]) : null,
      parentBookingId: details["Parent Booking Id"] ? String(details["Parent Booking Id"]) : null,
      buyerEmail: details["Buyer Email"] ? String(details["Buyer Email"]) : null,
    };

    logger.info({
      msg: "KonfHub webhook received",
      webhookId,
      eventType,
      bookingId: attendee.bookingId,
      attendeeEmail: attendee.email,
      ticketName: attendee.ticketName,
    });

    let result;
    
    switch (eventType) {
      case "registration":
        result = await handleRegistration(attendee, webhookId, eventAt, rawBody);
        break;
      case "cancel":
        result = await handleCancellation(attendee, webhookId, eventAt);
        break;
      case "check_in":
        result = await handleCheckIn(attendee, webhookId, eventAt);
        break;
      case "check_out":
        result = await handleCheckOut(attendee, webhookId, eventAt);
        break;
      default:
        logger.warn({ msg: "Unknown event type", rawEventType });
        result = { success: true, note: `Unknown event type: ${rawEventType}` };
    }

    logger.info({
      msg: "KonfHub webhook processed",
      webhookId,
      eventType,
      result,
    });

    res.status(200).json({
      webhookId,
      ...result,
    });
  } catch (error) {
    logger.error({
      msg: "KonfHub webhook: error processing",
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
