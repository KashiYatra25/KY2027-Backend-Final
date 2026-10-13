import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import {
  EventRegistrationModel,
  TeamModel,
} from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { RegisterForEventRequestSchemaType } from "@schemas/event/event.schema.js";

/**
 * MongoDB duplicate-key error code. Raised when an insert/upsert violates a
 * unique index (e.g. two concurrent registrations for the same user+event).
 */
const MONGO_DUPLICATE_KEY_ERROR = 11000;

/**
 * Type guard for a MongoDB duplicate-key (E11000) error. This lets us treat a
 * lost race on a unique index as a clean "already registered" conflict rather
 * than an unhandled 500.
 */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === MONGO_DUPLICATE_KEY_ERROR
  );
}

/**
 * Get all team IDs that any of the given users belong to
 */
async function getTeamIdsForUsers(userIds: string[]): Promise<string[]> {
  const teams = await TeamModel.find({
    "members.userId": { $in: userIds },
  })
    .select("teamId")
    .lean();
  return teams.map((t) => t.teamId);
}

/**
 * POST /events/:slug/register
 * Register for an event
 * - INDIVIDUAL: type="individual"
 * - DUO/TEAM: type="team" with teamId
 */
const registerForEvent = catchAsync(
  async (
    req: Request & { validatedData?: RegisterForEventRequestSchemaType },
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const slug = req.params.slug as string;
    const { id: userId } = authReq.user;
    const body = req.validatedData!;

    // 1. Check event exists and registration is open
    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Event not found",
        }),
      );
    }

    if (!event.registrationOpen) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Registration is closed for this event",
        }),
      );
    }

    // 1.5. Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Registration deadline has passed for this event",
        }),
      );
    }

    // 1.6. Check max participants capacity (if set)
    if (event.maxParticipants !== null) {
      const currentRegistrationCount = await EventRegistrationModel.countDocuments({
        eventSlug: slug,
        status: { $in: ["pending", "confirmed"] }, // Don't count cancelled
      });

      if (currentRegistrationCount >= event.maxParticipants) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This event has reached maximum capacity. Registration is closed.",
            currentCount: currentRegistrationCount,
            maxParticipants: event.maxParticipants,
          }),
        );
      }
    }

    // 2. Handle based on request type (discriminated union)
    if (body.type === "individual") {
      // Validate event allows individual participation
      if (event.participationType !== "INDIVIDUAL") {
        return next(
          new BadRequest().handleResponse(res, {
            info: `This is a ${event.participationType.toLowerCase()} event. Please register with a team.`,
          }),
        );
      }

      // Note: isPaidUser check is handled by checkUserHasPaidMiddleware

      // Atomic duplicate-registration guard.
      //
      // Instead of find-then-create (which races: two concurrent requests can
      // both pass the `findOne` check and then both insert), we upsert on the
      // unique (eventSlug, userId) key. `$setOnInsert` only writes fields when
      // a new document is created; if the registration already exists the
      // document is returned unchanged. The unique partial index is the source
      // of truth, so even racing upserts resolve to exactly one document.
      let registration;
      let wasNewlyCreated = false;
      try {
        const result = await EventRegistrationModel.findOneAndUpdate(
          { eventSlug: slug, userId },
          {
            $setOnInsert: {
              eventSlug: slug,
              userId,
              participationType: "individual",
              status: "confirmed",
            },
          },
          { upsert: true, new: true, includeResultMetadata: true },
        );

        registration = result.value;
        // `updatedExisting` is false only when the upsert performed an insert.
        wasNewlyCreated = result.lastErrorObject?.updatedExisting === false;
      } catch (err) {
        // Lost the race on the unique index: another request inserted the same
        // (eventSlug, userId) between our upsert's find and modify phases.
        if (isDuplicateKeyError(err)) {
          return next(
            new BadRequest().handleResponse(res, {
              info: "You are already registered for this event",
            }),
          );
        }
        throw err;
      }

      if (!wasNewlyCreated || !registration) {
        // Document already existed before this request (or, defensively, the
        // upsert returned no document).
        return next(
          new BadRequest().handleResponse(res, {
            info: "You are already registered for this event",
          }),
        );
      }

      // Atomic capacity enforcement.
      //
      // The pre-insert count check above is only a fast-path rejection; under
      // concurrency several requests can pass it simultaneously. After we have
      // committed our own insert, re-count and if we overshot capacity, roll
      // back this registration so capacity is never exceeded.
      if (event.maxParticipants !== null) {
        const confirmedCount = await EventRegistrationModel.countDocuments({
          eventSlug: slug,
          status: { $in: ["pending", "confirmed"] },
        });

        if (confirmedCount > event.maxParticipants) {
          await EventRegistrationModel.deleteOne({ _id: registration._id });
          return next(
            new BadRequest().handleResponse(res, {
              info: "This event has reached maximum capacity. Registration is closed.",
              maxParticipants: event.maxParticipants,
            }),
          );
        }
      }

      new OkResponseStrategy().handleResponse(res, {
        info: "Successfully registered for event",
        registrationId: registration._id,
        eventSlug: event.slug,
        eventName: event.name,
        status: registration.status,
      });
    } else {
      // body.type === "team"
      // Validate event allows team/duo participation
      if (event.participationType === "INDIVIDUAL") {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This is an individual event. Please register without a team.",
          }),
        );
      }

      const teamId = body.teamId;

      // 1. Find team
      const team = await TeamModel.findOne({ teamId });
      if (!team) {
        return next(
          new NotFound().handleResponse(res, {
            info: "Team not found",
          }),
        );
      }

      // 2. Check user is in team
      const userInTeam = team.members.some((m) => m.userId === userId);
      if (!userInTeam) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "You are not a member of this team",
          }),
        );
      }

      // 3. Check team size fits event requirements
      const teamSize = team.members.length;
      const minSize = event.minTeamSize ?? 1;
      const maxSize = event.maxTeamSize ?? 100;

      // DUO must be exactly 2
      if (event.participationType === "DUO" && teamSize !== 2) {
        return next(
          new BadRequest().handleResponse(res, {
            info: `This is a duo event. Team must have exactly 2 members, but has ${teamSize}.`,
          }),
        );
      }

      // TEAM must be within range
      if (event.participationType === "TEAM") {
        if (teamSize < minSize || teamSize > maxSize) {
          return next(
            new BadRequest().handleResponse(res, {
              info: `Team size must be between ${minSize} and ${maxSize}, but has ${teamSize} members.`,
            }),
          );
        }
      }

      // 3.5. Check all team members have paid passes
      const memberIds = team.members.map((m) => m.userId);
      const paidMembers = await prisma.user.findMany({
        where: { 
          id: { in: memberIds },
          isPaidUser: true,
        },
        select: { id: true },
      });

      if (paidMembers.length !== memberIds.length) {
        const paidIds = new Set(paidMembers.map((p) => p.id));
        const unpaidMemberIds = memberIds.filter((id) => !paidIds.has(id));
        return next(
          new BadRequest().handleResponse(res, {
            info: "All team members must have purchased a pass before registering for events",
            unpaidMemberCount: unpaidMemberIds.length,
          }),
        );
      }

      // 4. Check team not already registered for this event
      const existingTeamReg = await EventRegistrationModel.findOne({
        eventSlug: slug,
        teamId,
      });

      if (existingTeamReg) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This team is already registered for this event",
          }),
        );
      }

      // 5. Check no team member is already registered (individually or via another team)
      // Note: memberIds was already extracted in step 3.5

      // Get all team IDs that these members belong to
      const memberTeamIds = await getTeamIdsForUsers(memberIds);

      const existingMemberRegs = await EventRegistrationModel.find({
        eventSlug: slug,
        $or: [
          { userId: { $in: memberIds } },
          { teamId: { $in: memberTeamIds } },
        ],
      });

      if (existingMemberRegs.length > 0) {
        // Find which members are already registered
        const regUserIds = existingMemberRegs
          .filter((r) => r.userId)
          .map((r) => r.userId as string);

        const regTeamIds = existingMemberRegs
          .filter((r) => r.teamId)
          .map((r) => r.teamId as string);

        // Get members who are in those teams
        const conflictingTeams = await TeamModel.find({
          teamId: { $in: regTeamIds },
        }).lean();
        const teamMemberIds = conflictingTeams.flatMap((t) =>
          t.members.map((m) => m.userId),
        );

        const conflictingMemberIds = [
          ...new Set([...regUserIds, ...teamMemberIds]),
        ].filter((id) => memberIds.includes(id));

        return next(
          new BadRequest().handleResponse(res, {
            info: "Some team members are already registered for this event",
            conflictingMemberIds,
          }),
        );
      }

      // 6. Create registration.
      //
      // Steps 4 and 5 above check for duplicate-team and cross-team member
      // conflicts, but find-then-create still races under concurrency. The
      // upsert on the unique (eventSlug, teamId) partial index makes the
      // team-duplicate case atomic: concurrent requests for the same team
      // converge on one document, and a lost race surfaces as E11000 which we
      // translate into a clean 409-style 400 response.
      const participationType =
        event.participationType === "DUO" ? "duo" : "team";

      let registration;
      let wasNewlyCreated = false;
      try {
        const result = await EventRegistrationModel.findOneAndUpdate(
          { eventSlug: slug, teamId },
          {
            $setOnInsert: {
              eventSlug: slug,
              participationType,
              teamId,
              status: "confirmed",
            },
          },
          { upsert: true, new: true, includeResultMetadata: true },
        );

        registration = result.value;
        wasNewlyCreated = result.lastErrorObject?.updatedExisting === false;
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          return next(
            new BadRequest().handleResponse(res, {
              info: "This team is already registered for this event",
            }),
          );
        }
        throw err;
      }

      if (!wasNewlyCreated || !registration) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "This team is already registered for this event",
          }),
        );
      }

      // Atomic capacity enforcement: re-count after our insert and roll back
      // if we pushed the event past capacity (see individual path for rationale).
      if (event.maxParticipants !== null) {
        const confirmedCount = await EventRegistrationModel.countDocuments({
          eventSlug: slug,
          status: { $in: ["pending", "confirmed"] },
        });

        if (confirmedCount > event.maxParticipants) {
          await EventRegistrationModel.deleteOne({ _id: registration._id });
          return next(
            new BadRequest().handleResponse(res, {
              info: "This event has reached maximum capacity. Registration is closed.",
              maxParticipants: event.maxParticipants,
            }),
          );
        }
      }

      new OkResponseStrategy().handleResponse(res, {
        info: "Team successfully registered for event",
        registrationId: registration._id,
        eventSlug: event.slug,
        eventName: event.name,
        teamId: team.teamId,
        teamName: team.name,
        memberCount: teamSize,
        status: registration.status,
      });
    }
  },
);

export { registerForEvent };
