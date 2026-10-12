import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import {
  ScheduleEntryModel,
  VenueModel,
  FestDayModel,
} from "@root/databaseManagers/mongoose/index.js";
import { prisma } from "@root/prisma.js";

// ═══════════════════════════════════════════════════════════════════
// GET SCHEDULE CONTROLLER
// Public endpoint - returns full schedule with events, venues, and days
// This is the main endpoint for the schedule page
// ═══════════════════════════════════════════════════════════════════

export const getSchedule = catchAsync(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    // Optional filters
    const { day, venue, category } = req.query;

    // Build query
    const query: Record<string, unknown> = { active: true };
    if (day) query.day = parseInt(day as string);
    if (venue) query.venueSlug = (venue as string).toLowerCase();
    if (category) query.categorySlug = (category as string).toUpperCase();

    // Fetch schedule entries with venue populated
    const scheduleEntries = await ScheduleEntryModel.find(query)
      .populate("venueId")
      .sort({ day: 1, sortOrder: 1 })
      .lean();

    // Get all event slugs to fetch from Prisma
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

    // Fetch all venues for the response
    const venues = await VenueModel.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("-__v -createdAt -updatedAt")
      .lean();

    // Format venues
    const formattedVenues = venues.map((venue) => ({
      slug: venue.slug,
      name: venue.name,
      label: venue.label,
      tone: venue.tone,
      large: venue.large || undefined,
      x: venue.x,
      y: venue.y,
      anchor: venue.anchorX && venue.anchorY ? [venue.anchorX, venue.anchorY] : undefined,
      clickable: venue.clickable,
    }));

    // Create venue lookup map
    const venueMap = new Map(formattedVenues.map((v) => [v.slug, v]));

    // Fetch fest days
    const festDays = await FestDayModel.find({ active: true })
      .sort({ dayNumber: 1 })
      .lean();

    const festDaysMap: Record<number, string> = {};
    festDays.forEach((day) => {
      festDaysMap[day.dayNumber] = day.displayDate;
    });

    // Build scheduled events in the format frontend expects
    const scheduledEvents = scheduleEntries
      .map((entry) => {
        const event = eventMap.get(entry.eventSlug);
        const venue = venueMap.get(entry.venueSlug);

        if (!event || !venue) return null;

        return {
          event: {
            id: event.slug, // Use slug as ID for frontend compatibility
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
          venue,
          day: entry.day,
          startTime: entry.startTime,
          endTime: entry.endTime,
        };
      })
      .filter(Boolean);

    new OkResponseStrategy().handleResponse(res, {
      info: "Schedule fetched successfully",
      scheduledEvents,
      venues: formattedVenues,
      festDays: festDaysMap,
      count: scheduledEvents.length,
    });
  },
);

// Helper function to get category display name
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
