import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { EventRegistrationModel } from "@lib/mongo/event/eventRegistration.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import type {
  GetEventsQueryType,
} from "@root/controller/middleware/schemas/event/event.schema.js";

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
    const { category, participationType, registrationOpen } = req.validatedQuery ?? {};

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
      orderBy: [
        { category: "asc" },
        { name: "asc" },
      ],
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
      data: events,
    });
  },
);

/**
 * GET /events/:slug
 * Get single event details by slug
 */
const getEventBySlug = catchAsync(
  async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const slug = req.params.slug as string;

    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      new NotFound().handleResponse(res, {
        info: "Event not found",
      });
      return;
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Event fetched successfully",
      data: event,
    });
  },
);

/**
 * POST /events/:slug/register
 * Register current user for an individual event
 */
const registerForEvent = catchAsync(
  async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    // Cast to get user from auth middleware
    const authReq = req as AuthenticatedUserRequestWithVerifiedEmail;
    const slug = req.params.slug as string;
    const { id: userId } = authReq.user;

    // 1. Check event exists and registration is open
    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      new NotFound().handleResponse(res, {
        info: "Event not found",
      });
      return;
    }

    if (!event.registrationOpen) {
      new BadRequest().handleResponse(res, {
        info: "Registration is closed for this event",
      });
      return;
    }

    // 2. Check if it's an individual event
    if (event.participationType !== "INDIVIDUAL") {
      new BadRequest().handleResponse(res, {
        info: `This is a ${event.participationType.toLowerCase()} event. Use team registration instead.`,
      });
      return;
    }

    // 3. Check if already registered
    const existingRegistration = await EventRegistrationModel.findOne({
      eventSlug: slug,
      userId,
    });

    if (existingRegistration) {
      new BadRequest().handleResponse(res, {
        info: "You are already registered for this event",
      });
      return;
    }

    // 4. Create registration
    const registration = await EventRegistrationModel.create({
      eventSlug: slug,
      participationType: "individual",
      userId,
      status: "confirmed", // individual registrations are instant
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Successfully registered for event",
      data: {
        registrationId: registration._id,
        eventSlug: event.slug,
        eventName: event.name,
        status: registration.status,
      },
    });
  },
);

export { getEvents, getEventBySlug, registerForEvent };
