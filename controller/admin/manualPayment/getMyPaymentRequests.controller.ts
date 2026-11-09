import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY PAYMENT REQUESTS
// 
// Fetch manual payment requests created by the current admin.
// Supports pagination and status filtering. Returns global stats.
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/manual-payment/my-requests
 * Get manual payment requests created by the current admin
 * 
 * Query params:
 * - status: "PENDING" | "APPROVED" | "REJECTED" (optional filter)
 * - page: number (default 1)
 * - limit: number (default 20, max 50)
 */
export const getMyPaymentRequests = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = (req.query.status as string)?.toUpperCase();

    // Base query - only requests created by this admin
    const baseQuery: Record<string, unknown> = {
      requestedBy: req.admin.email,
    };

    // Build query with optional status filter
    const query: Record<string, unknown> = { ...baseQuery };
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      query.status = status;
    }

    // Get total count for current filter
    const totalCount = await ManualPaymentRequestModel.countDocuments(query);

    // Get paginated requests
    const requests = await ManualPaymentRequestModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    // Get global stats for this admin's requests (independent of status filter)
    const [pendingCount, approvedCount, rejectedCount, totalAmountResult] = await Promise.all([
      ManualPaymentRequestModel.countDocuments({ ...baseQuery, status: "PENDING" }),
      ManualPaymentRequestModel.countDocuments({ ...baseQuery, status: "APPROVED" }),
      ManualPaymentRequestModel.countDocuments({ ...baseQuery, status: "REJECTED" }),
      ManualPaymentRequestModel.aggregate([
        { $match: baseQuery },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    // Get approved amount separately
    const approvedAmountResult = await ManualPaymentRequestModel.aggregate([
      { $match: { ...baseQuery, status: "APPROVED" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: "My payment requests fetched successfully",
      requests: requests.map((r) => ({
        requestId: r.requestId,
        requestedBy: r.requestedBy,
        requestedByName: r.requestedByName || null,
        requestedByRole: r.requestedByRole || null,
        users: r.users,
        numberOfPasses: r.numberOfPasses,
        passType: r.passType,
        collegeSlug: r.collegeSlug,
        paymentMethod: r.paymentMethod,
        amount: r.amount,
        bonafides: r.bonafides,
        status: r.status,
        processedBy: r.processedBy,
        processedByName: r.processedByName || null,
        processedByRole: r.processedByRole || null,
        processedAt: r.processedAt,
        processNote: r.processNote,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
      // Global stats for this admin (independent of filters/pagination)
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
        totalAmount: totalAmountResult[0]?.total || 0,
        approvedAmount: approvedAmountResult[0]?.total || 0,
      },
    });
  },
);
