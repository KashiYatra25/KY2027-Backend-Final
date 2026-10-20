import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

/**
 * GET /admin/registrations
 * Get all event registrations with details
 * 
 * Query params:
 * - page: number (default 1)
 * - limit: number (default 20, max 50)
 * - eventSlug: string (filter by event)
 * - status: string (filter by status: pending, confirmed, cancelled, waitlisted)
 * - participationType: string (filter by type: individual, duo, team)
 * 
 * Requires: MASTER_ADMIN or MANAGER role
 */
const getAllRegistrations = catchAsync(
  async (
    req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const eventSlug = (req.query.eventSlug as string)?.trim() || "";
    const status = (req.query.status as string)?.trim() || "";
    const participationType = (req.query.participationType as string)?.trim() || "";

    // Build query
    const query: Record<string, unknown> = {};
    if (eventSlug) {
      query.eventSlug = eventSlug;
    }
    if (status) {
      query.status = status;
    }
    if (participationType) {
      query.participationType = participationType;
    }

    // Get total count
    const totalCount = await EventRegistrationModel.countDocuments(query);

    // Get paginated registrations
    const registrations = await EventRegistrationModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get all unique event slugs, user IDs, and team IDs
    const eventSlugs = [...new Set(registrations.map(r => r.eventSlug))];
    const userIds = [...new Set(registrations.filter(r => r.userId).map(r => r.userId as string))];
    const teamIds = [...new Set(registrations.filter(r => r.teamId).map(r => r.teamId as string))];

    // Fetch event details from Prisma
    const events = await prisma.event.findMany({
      where: { slug: { in: eventSlugs } },
      select: {
        slug: true,
        name: true,
        tagline: true,
        category: true,
        participationType: true,
        imageUrl: true,
        startsAt: true,
        venue: true,
        minTeamSize: true,
        maxTeamSize: true,
      },
    });
    const eventMap = new Map(events.map(e => [e.slug, e]));

    // Fetch user details for individual registrations
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
      },
    }) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Fetch team details
    const teams = teamIds.length > 0 ? await TeamModel.find({ teamId: { $in: teamIds } }).lean() : [];
    const teamMap = new Map(teams.map(t => [t.teamId, t]));

    // Get all member user IDs from teams
    const teamMemberIds = [...new Set(teams.flatMap(t => t.members.map(m => m.userId)))];
    const teamMemberUserIds = teamMemberIds.filter(id => !userMap.has(id));
    
    // Fetch team member details
    const teamMembers = teamMemberUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: teamMemberUserIds } },
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
      },
    }) : [];
    
    // Merge into userMap
    teamMembers.forEach(u => userMap.set(u.id, u));

    // Transform registrations with details
    const registrationsWithDetails = registrations.map(reg => {
      const event = eventMap.get(reg.eventSlug);
      const user = reg.userId ? userMap.get(reg.userId) : null;
      const team = reg.teamId ? teamMap.get(reg.teamId) : null;

      return {
        registrationId: reg._id.toString(),
        eventSlug: reg.eventSlug,
        event: event ? {
          slug: event.slug,
          name: event.name,
          tagline: event.tagline,
          category: event.category,
          participationType: event.participationType,
          imageUrl: event.imageUrl,
          startsAt: event.startsAt,
          venue: event.venue,
          minTeamSize: event.minTeamSize,
          maxTeamSize: event.maxTeamSize,
        } : null,
        participationType: reg.participationType,
        status: reg.status,
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
        } : null,
        team: team ? {
          teamId: team.teamId,
          name: team.name,
          memberCount: team.members.length,
          members: team.members.map(m => {
            const member = userMap.get(m.userId);
            return {
              userId: m.userId,
              firstName: member?.firstName,
              lastName: member?.lastName,
              email: member?.email,
              googleAvatarUrl: member?.googleAvatarUrl,
              college: member?.college,
              isPaidUser: member?.isPaidUser,
              kyId: member?.kyId,
            };
          }),
        } : null,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    // Also get stats
    const [totalRegistrations, individualCount, duoCount, teamCount, confirmedCount, pendingCount] = await Promise.all([
      EventRegistrationModel.countDocuments({}),
      EventRegistrationModel.countDocuments({ participationType: "individual" }),
      EventRegistrationModel.countDocuments({ participationType: "duo" }),
      EventRegistrationModel.countDocuments({ participationType: "team" }),
      EventRegistrationModel.countDocuments({ status: "confirmed" }),
      EventRegistrationModel.countDocuments({ status: "pending" }),
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: "Registrations fetched successfully",
      registrations: registrationsWithDetails,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        total: totalRegistrations,
        individual: individualCount,
        duo: duoCount,
        team: teamCount,
        confirmed: confirmedCount,
        pending: pendingCount,
      },
    });
  },
);

export { getAllRegistrations };
