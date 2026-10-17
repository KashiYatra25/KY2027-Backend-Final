import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY PURCHASES CONTROLLER
// Returns all pass purchases for the authenticated user
// ═══════════════════════════════════════════════════════════════════

export const getMyPurchases = catchAsync(
  async (req: AuthenticatedUserRequestWithVerifiedEmail, res: Response) => {
    const { id: userId } = req.user;

    // Get all purchases for this user, sorted by most recent first
    const purchases = await PurchaseModel.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Transform purchases for frontend
    const formattedPurchases = purchases.map((purchase) => ({
      id: purchase._id.toString(),
      source: purchase.source,
      passType: purchase.passType,
      amountPaid: purchase.amountPaid,
      currency: purchase.currency,
      status: purchase.status,
      benefits: purchase.benefits,
      
      // Dates
      createdAt: purchase.createdAt,
      verifiedAt: purchase.manualVerification?.verifiedAt || purchase.konfhub?.registeredAt,
      checkedInAt: purchase.checkIn?.checkedInAt || purchase.konfhub?.checkedInAt,
      
      // For pending manual verification
      isPending: purchase.status === "PENDING_VERIFICATION",
      rejectionReason: purchase.manualVerification?.rejectionReason,
      
      // KonfHub specific
      konfhubBookingId: purchase.konfhub?.bookingId,
      konfhubTicketName: purchase.konfhub?.ticketName,
      ticketUrl: purchase.konfhub?.ticketUrl,
      invoiceUrl: purchase.konfhub?.invoiceUrl,
    }));

    // Separate active and history
    const activePurchases = formattedPurchases.filter(
      (p) => p.status === "VERIFIED" || p.status === "CHECKED_IN" || p.status === "PENDING_VERIFICATION"
    );
    const historyPurchases = formattedPurchases.filter(
      (p) => p.status === "CANCELLED" || p.status === "REJECTED" || p.status === "CHECKED_OUT"
    );

    new OkResponseStrategy().handleResponse(res, {
      info: "Purchases fetched successfully",
      purchases: formattedPurchases,
      active: activePurchases,
      history: historyPurchases,
      count: formattedPurchases.length,
    });
  }
);
