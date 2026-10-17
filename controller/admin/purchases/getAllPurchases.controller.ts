import type { Request, Response } from "express";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// GET ALL PURCHASES (Admin)
// Lists all purchases with filtering by status, source, etc.
// ═══════════════════════════════════════════════════════════════════

interface GetPurchasesQuery {
  status?: string;
  source?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export const getAllPurchases = async (
  req: Request<unknown, unknown, unknown, GetPurchasesQuery>,
  res: Response
) => {
  const {
    status,
    source,
    search,
    page = "1",
    limit = "20",
  } = req.query;

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

  try {
    const [purchases, total] = await Promise.all([
      PurchaseModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PurchaseModel.countDocuments(filter),
    ]);

    // Get counts by status for dashboard
    const statusCounts = await PurchaseModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = statusCounts.reduce(
      (acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      },
      {} as Record<string, number>
    );

    res.status(200).json({
      statusCode: 200,
      message: "Purchases fetched successfully",
      data: {
        purchases,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
        counts,
      },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to fetch purchases",
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to fetch purchases",
    });
  }
};
