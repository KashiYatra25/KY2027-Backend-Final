import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { GetPurchasesQuery } from "@controller/admin/helper/types/purchases.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL PURCHASES (Admin)
// Lists all purchases with filtering by status, source, etc.
// ═══════════════════════════════════════════════════════════════════

export const getAllPurchases = catchAsync(
  async (
    req: VerifiedRequest<{ query: GetPurchasesQuery }, AdminRequestWithVerifiedCreds>,
    res: Response,
  ) => {
    const { status, source, search, page = "1", limit = "20" } = req.validatedQuery;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: Record<string, unknown> = {};

    if (status) {
      filter.status = status;
    }

    if (source) {
      filter.source = source;
    }

    if (search) {
      filter.$or = [
        { "userSnapshot.email": { $regex: search, $options: "i" } },
        { "userSnapshot.name": { $regex: search, $options: "i" } },
        { "userSnapshot.kyId": { $regex: search, $options: "i" } },
        { "konfhub.attendeeEmail": { $regex: search, $options: "i" } },
        { "manualVerification.transactionId": { $regex: search, $options: "i" } },
        { userId: search },
      ];
    }

    const [purchases, total] = await Promise.all([
      PurchaseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      PurchaseModel.countDocuments(filter),
    ]);

    // Get counts by status for dashboard
    const statusCounts = await PurchaseModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = statusCounts.reduce<Record<string, number>>((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    new OkResponseStrategy().handleResponse(res, {
      info: "Purchases fetched successfully",
      purchases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      counts,
    });
  },
);
