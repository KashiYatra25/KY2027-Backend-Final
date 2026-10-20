import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// GET REVENUE ANALYTICS (Admin)
// GET /admin/revenue?days=30
//
// Aggregates the Purchase collection into:
//   - headline totals (revenue, count, average)
//   - date-wise revenue trend (for a line/area chart)
//   - pass-wise revenue + count breakdown (for a bar chart)
//
// Only "earning" purchases are counted: VERIFIED and CHECKED_IN.
// (PENDING_VERIFICATION / CANCELLED / REJECTED / CHECKED_OUT excluded.)
//
// Requires: MASTER_ADMIN or MANAGER role (enforced at the route).
// ═══════════════════════════════════════════════════════════════════

const EARNING_STATUSES = ["VERIFIED", "CHECKED_IN"] as const;

const getRevenueAnalytics = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    // Optional trend window in days (default 30, capped 1..365).
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const earningMatch = { status: { $in: [...EARNING_STATUSES] } };

    // ─── Headline totals ─────────────────────────────────────────────
    const totalsAgg = await PurchaseModel.aggregate<{
      _id: null;
      totalRevenue: number;
      totalPurchases: number;
    }>([
      { $match: earningMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amountPaid" },
          totalPurchases: { $sum: 1 },
        },
      },
    ]);

    const totalRevenue = totalsAgg[0]?.totalRevenue ?? 0;
    const totalPurchases = totalsAgg[0]?.totalPurchases ?? 0;
    const averageOrderValue =
      totalPurchases > 0 ? Math.round(totalRevenue / totalPurchases) : 0;

    // ─── Date-wise trend (within the window) ─────────────────────────
    const byDateAgg = await PurchaseModel.aggregate<{
      _id: string;
      revenue: number;
      count: number;
    }>([
      { $match: { ...earningMatch, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
          },
          revenue: { $sum: "$amountPaid" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build a zero-filled continuous series so the chart has no gaps.
    const byDateMap = new Map(byDateAgg.map((d) => [d._id, d]));
    const revenueByDate: { date: string; revenue: number; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      // YYYY-MM-DD in local (IST) terms to match the aggregation timezone.
      const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const found = byDateMap.get(key);
      revenueByDate.push({
        date: key,
        revenue: found?.revenue ?? 0,
        count: found?.count ?? 0,
      });
    }

    // ─── Pass-wise breakdown ─────────────────────────────────────────
    const byPassAgg = await PurchaseModel.aggregate<{
      _id: string;
      revenue: number;
      count: number;
    }>([
      { $match: earningMatch },
      {
        $group: {
          _id: "$passType",
          revenue: { $sum: "$amountPaid" },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const revenueByPass = byPassAgg.map((p) => ({
      passType: p._id ?? "Unknown",
      revenue: p.revenue,
      count: p.count,
    }));

    new OkResponseStrategy().handleResponse(res, {
      info: "Revenue analytics fetched successfully",
      rangeDays: days,
      currency: "INR",
      totals: {
        totalRevenue,
        totalPurchases,
        averageOrderValue,
      },
      revenueByDate,
      revenueByPass,
    });
  },
);

export { getRevenueAnalytics };
