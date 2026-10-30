import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET MANUAL PAYMENT REQUESTS
// 
// Fetch all manual payment requests with optional status filter.
// Supports pagination.
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/manual-payment/requests
 * Get all manual payment requests
 * 
 * Query params:
 * - status: "PENDING" | "APPROVED" | "REJECTED" (optional filter)
 * - page: number (default 1)
 * - limit: number (default 20, max 50)
 */
export const getManualPaymentRequests = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = (req.query.status as string)?.toUpperCase();

    // Build query
    const query: Record<string, unknown> = {};
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      query.status = status;
    }

    // Get total count
    const totalCount = await ManualPaymentRequestModel.countDocuments(query);

    // Get paginated requests
    const requests = await ManualPaymentRequestModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalCount / limit);

    new OkResponseStrategy().handleResponse(res, {
      info: "Manual payment requests fetched successfully",
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
    });
  },
);
