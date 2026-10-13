import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@lib/mongo/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY PURCHASES CONTROLLER
// Returns all purchases for the authenticated user
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
      orderId: purchase.orderId,
      status: purchase.status,
      items: purchase.items.map((item) => ({
        passId: item.passId,
        passName: item.passName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      subtotal: purchase.subtotal,
      discount: purchase.discount,
      totalAmount: purchase.totalAmount,
      couponCode: purchase.couponCode,
      paymentMethod: purchase.paymentMethod,
      paidAt: purchase.paidAt,
      createdAt: purchase.createdAt,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Purchases fetched successfully",
      purchases: formattedPurchases,
      count: formattedPurchases.length,
    });
  }
);
