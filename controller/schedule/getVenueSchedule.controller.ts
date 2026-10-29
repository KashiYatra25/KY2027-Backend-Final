import type { Response, NextFunction } from "express";
import type { Request } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { ScheduleEntryModel, VenueModel, FestDayModel } from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";
import type { VenueSlugParamSchemaType } from "@schemas/schedule/schedule.schema.js";

// ═══════════════════════════════════════════════════════════════════
// GET VENUE SCHEDULE CONTROLLER
// Public endpoint - returns schedule for a specific venue
// Used for venue detail pages
// ═══════════════════════════════════════════════════════════════════

export const getVenueSchedule = catchAsync(
  async (
    req: VerifiedRequest<{ params: VenueSlugParamSchemaType }, Request>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { venueSlug } = req.validatedParams;

    // Find venue
    const venue = await VenueModel.findOne({
      slug: venueSlug.toLowerCase(),
      active: true,
      clickable: true,
    }).lean();

    if (!venue) {
      return next(new NotFound().handleResponse(res, {
        info: "Venue not found",
      }));
    }

    // Fetch schedule entries for this venue
    const scheduleEntries = await ScheduleEntryModel.find({
      venueSlug: venueSlug.toLowerCase(),
      active: true,
    })
      .sort({ day: 1, sortOrder: 1 })
      .lean();

    // Get all event slugs
    const eventSlugs = scheduleEntries.map((entry) => entry.eventSlug);

    // Fetch events from Prisma
    const events = await prisma.event.findMany({
      where: {
        slug: { in: eventSlugs },
      },
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
      },
    });

    // Create event lookup map
    const eventMap = new Map(events.map((e) => [e.slug, e]));

    // Fetch fest days
    const festDays = await FestDayModel.find({ active: true }).sort({ dayNumber: 1 }).lean();
    const festDaysMap: Record<number, string> = {};
    festDays.forEach((day) => {
      festDaysMap[day.dayNumber] = day.displayDate;
    });

    // Format venue
    const formattedVenue = {
      slug: venue.slug,
      name: venue.name,
      label: venue.label,
      tone: venue.tone,
      large: venue.large || undefined,
      x: venue.x,
      y: venue.y,
      anchor: venue.anchorX && venue.anchorY ? [venue.anchorX, venue.anchorY] : undefined,
      clickable: venue.clickable,
    };

    // Build scheduled events
    type ScheduledEventType = {
      event: {
        id: string;
        name: string;
        tagline: string;
        description: string | null;
        type: string;
        teamSize: string | undefined;
        registrationOpen: boolean;
      };
      category: {
        id: string;
        name: string;
        slug: string;
      };
      day: number;
      startTime: string | undefined;
      endTime: string | undefined;
    };

    const scheduledEvents: ScheduledEventType[] = [];

    for (const entry of scheduleEntries) {
      const event = eventMap.get(entry.eventSlug);
      if (!event) continue;

      scheduledEvents.push({
        event: {
          id: event.slug,
          name: event.name,
          tagline: event.tagline,
          description: event.description,
          type:
            event.participationType === "INDIVIDUAL"
              ? "individual"
              : event.participationType === "DUO"
                ? "duo"
                : "team",
          teamSize:
            event.minTeamSize && event.maxTeamSize
              ? `${event.minTeamSize}-${event.maxTeamSize} members`
              : undefined,
          registrationOpen: event.registrationOpen,
        },
        category: {
          id: event.category.toLowerCase(),
          name: getCategoryName(event.category),
          slug: event.category.toLowerCase(),
        },
        day: entry.day,
        startTime: entry.startTime ?? undefined,
        endTime: entry.endTime ?? undefined,
      });
    }

    // Group by day
    const eventsByDay: Record<number, ScheduledEventType[]> = {};
    for (const event of scheduledEvents) {
      const dayKey = event.day;
      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }
      eventsByDay[dayKey]!.push(event);
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Venue schedule fetched successfully",
      venue: formattedVenue,
      scheduledEvents,
      eventsByDay,
      festDays: festDaysMap,
      count: scheduledEvents.length,
    });
  },
);

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    NATRAJ: "Natraj",
    CROSSWINDZ: "Crosswindz",
    BANDISH: "Bandish",
    ABHINAY: "Abhinay",
    MIRAGE: "Mirage",
    TOOLIKA: "Toolika",
    ENQUIZTA: "Enquizta",
    SAMWAAD: "Samwaad",
    ZAIKA: "Zaika",
  };
  return names[category] || category;
}
