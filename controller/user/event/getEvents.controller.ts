import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { GetEventsQueryType } from "@schemas/event/event.schema.js";

/**
 * GET /events
 * List all events with optional filters
 */
const getEvents = catchAsync(
  async (
    req: Request & { validatedQuery?: GetEventsQueryType },
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { category, participationType, registrationOpen } =
      req.validatedQuery ?? {};

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }
    if (participationType) {
      where.participationType = participationType;
    }
    if (registrationOpen !== undefined) {
      where.registrationOpen = registrationOpen;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        category: true,
        participationType: true,
        minTeamSize: true,
        maxTeamSize: true,
        registrationOpen: true,
        imageUrl: true,
        prizePool: true,
      },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Events fetched successfully",
      events,
    });
  },
);

export { getEvents };
