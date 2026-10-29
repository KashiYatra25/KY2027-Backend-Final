import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { ZonalUserCollegeModel } from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

/**
 * GET /admin/zonals/registrations
 * Get all zonal registrations/passes with details
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20, max 50)
 * - collegeSlug: string (filter by college)
 * - passType: string (filter by type: SINGLE_EVENT, MULTI_EVENT)
 * - paymentStatus: string (filter by status: pending, completed, failed, refunded)
 * - search: string (search by email, name, kyId)
 * 
 * Requires: MASTER_ADMIN or MANAGER role
 */
const getZonalRegistrations = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const collegeSlug = (req.query.collegeSlug as string)?.trim() || "";
    const passType = (req.query.passType as string)?.trim() || "";
    const paymentStatus = (req.query.paymentStatus as string)?.trim() || "";
    const search = (req.query.search as string)?.trim() || "";

    // Build query
    const query: Record<string, unknown> = {};
    
    if (collegeSlug) {
      query.collegeSlug = collegeSlug;
    }
    
    // Filter by pass type (at least one pass of this type)
    if (passType) {
      query["passes.passType"] = passType;
    }
    
    // Filter by payment status (at least one pass with this status)
    if (paymentStatus) {
      query["passes.paymentStatus"] = paymentStatus;
    }

    // Search by user snapshot fields
    if (search) {
      query.$or = [
        { "userSnapshot.email": { $regex: search, $options: "i" } },
        { "userSnapshot.name": { $regex: search, $options: "i" } },
        { "userSnapshot.kyId": { $regex: search, $options: "i" } },
        { "userSnapshot.phone": { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const totalCount = await ZonalUserCollegeModel.countDocuments(query);

    // Get paginated registrations
    const zonalPasses = await ZonalUserCollegeModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get all unique user IDs
    const userIds = [...new Set(zonalPasses.map(z => z.userId))];

    // Fetch user details from Prisma
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        googleAvatarUrl: true,
        candidatePhotoUrl: true,
        college: true,
        isPaidUser: true,
        kyId: true,
        phone: true,
      },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Transform zonal passes with details
    const zonalRegistrationsWithDetails = zonalPasses.map(zonal => {
      const user = userMap.get(zonal.userId);
      
      // Calculate totals
      const totalPasses = zonal.passes.length;
      const completedPasses = zonal.passes.filter(p => p.paymentStatus === "completed").length;
      const totalAmount = zonal.passes
        .filter(p => p.paymentStatus === "completed")
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      // Get latest pass purchase
      const latestPass = zonal.passes.length > 0 
        ? zonal.passes.reduce((latest, p) => 
            new Date(p.purchasedAt || 0) > new Date(latest.purchasedAt || 0) ? p : latest
          )
        : null;

      return {
        id: zonal._id.toString(),
        userId: zonal.userId,
        collegeSlug: zonal.collegeSlug,
        eventLimit: zonal.eventLimit,
        registeredEventsCount: zonal.registeredEvents.length,
        registeredEvents: zonal.registeredEvents,
        passes: zonal.passes.map(p => ({
          id: p._id?.toString(),
          passType: p.passType,
          amount: p.amount,
          paymentStatus: p.paymentStatus,
          paymentId: p.paymentId,
          paymentSource: p.paymentSource,
          ticketUrl: p.ticketUrl,
          invoiceUrl: p.invoiceUrl,
          purchasedAt: p.purchasedAt,
        })),
        totalPasses,
        completedPasses,
        totalAmount,
        latestPassType: latestPass?.passType || null,
        latestPaymentStatus: latestPass?.paymentStatus || null,
        user: user ? {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          googleAvatarUrl: user.googleAvatarUrl,
          candidatePhotoUrl: user.candidatePhotoUrl,
          college: user.college,
          isPaidUser: user.isPaidUser,
          kyId: user.kyId,
          phone: user.phone,
        } : zonal.userSnapshot ? {
          // Fallback to snapshot if user not found
          userId: zonal.userId,
          firstName: zonal.userSnapshot.name?.split(" ")[0],
          lastName: zonal.userSnapshot.name?.split(" ").slice(1).join(" "),
          email: zonal.userSnapshot.email,
          college: zonal.userSnapshot.college,
          kyId: zonal.userSnapshot.kyId,
          phone: zonal.userSnapshot.phone,
        } : null,
        createdAt: zonal.createdAt,
        updatedAt: zonal.updatedAt,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Get stats - aggregate across all documents
    const [
      totalZonalPasses,
      uniqueUsers,
      singleEventPasses,
      multiEventPasses,
      completedPayments,
      pendingPayments,
      totalRegisteredEvents,
    ] = await Promise.all([
      ZonalUserCollegeModel.countDocuments({}),
      ZonalUserCollegeModel.distinct("userId").then(ids => ids.length),
      ZonalUserCollegeModel.countDocuments({ "passes.passType": "SINGLE_EVENT" }),
      ZonalUserCollegeModel.countDocuments({ "passes.passType": "MULTI_EVENT" }),
      ZonalUserCollegeModel.countDocuments({ "passes.paymentStatus": "completed" }),
      ZonalUserCollegeModel.countDocuments({ "passes.paymentStatus": "pending" }),
      ZonalUserCollegeModel.aggregate([
        { $project: { count: { $size: "$registeredEvents" } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).then(result => result[0]?.total || 0),
    ]);

    // Get revenue stats
    const revenueStats = await ZonalUserCollegeModel.aggregate([
      { $unwind: "$passes" },
      { $match: { "passes.paymentStatus": "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$passes.amount" },
          avgAmount: { $avg: "$passes.amount" },
        },
      },
    ]);

    // Get college-wise breakdown
    const collegeStats = await ZonalUserCollegeModel.aggregate([
      {
        $group: {
          _id: "$collegeSlug",
          count: { $sum: 1 },
          registeredEvents: { $sum: { $size: "$registeredEvents" } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: "Zonal registrations fetched successfully",
      registrations: zonalRegistrationsWithDetails,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        totalPasses: totalZonalPasses,
        uniqueUsers,
        singleEvent: singleEventPasses,
        multiEvent: multiEventPasses,
        completed: completedPayments,
        pending: pendingPayments,
        totalRegisteredEvents,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        avgAmount: Math.round(revenueStats[0]?.avgAmount || 0),
      },
      collegeBreakdown: collegeStats.map(c => ({
        collegeSlug: c._id,
        passCount: c.count,
        registeredEvents: c.registeredEvents,
      })),
    });
  },
);

export { getZonalRegistrations };
