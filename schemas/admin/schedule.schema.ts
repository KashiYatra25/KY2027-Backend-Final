import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════
// VENUE SCHEMAS
// ═══════════════════════════════════════════════════════════════════

const LABEL_TONES = ["blue", "red", "green", "white", "text"] as const;

export const createVenueSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(50, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  label: z.string().min(1, "Label is required").max(100, "Label too long"),
  tone: z.enum(LABEL_TONES).default("blue"),
  large: z.boolean().optional(),
  x: z.number().min(0).max(100, "X must be 0-100"),
  y: z.number().min(0).max(100, "Y must be 0-100"),
  anchorX: z.number().min(0).max(100).optional(),
  anchorY: z.number().min(0).max(100).optional(),
  clickable: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateVenueSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  tone: z.enum(LABEL_TONES).optional(),
  large: z.boolean().optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  anchorX: z.number().min(0).max(100).nullable().optional(),
  anchorY: z.number().min(0).max(100).nullable().optional(),
  clickable: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const venueIdParamSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
});

// ═══════════════════════════════════════════════════════════════════
// FEST DAY SCHEMAS
// ═══════════════════════════════════════════════════════════════════

export const createFestDaySchema = z.object({
  dayNumber: z.number().int().min(1, "Day number must be at least 1"),
  date: z.string().datetime({ message: "Invalid date format" }),
  displayDate: z.string().min(1, "Display date is required").max(20, "Display date too long"),
  name: z.string().max(50).optional(),
  active: z.boolean().default(true),
});

export const updateFestDaySchema = z.object({
  dayNumber: z.number().int().min(1).optional(),
  date: z.string().datetime().optional(),
  displayDate: z.string().min(1).max(20).optional(),
  name: z.string().max(50).nullable().optional(),
  active: z.boolean().optional(),
});

export const festDayIdParamSchema = z.object({
  festDayId: z.string().min(1, "FestDay ID is required"),
});

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ENTRY SCHEMAS
// ═══════════════════════════════════════════════════════════════════

const EVENT_CATEGORIES = [
  "NATRAJ",
  "CROSSWINDZ",
  "BANDISH",
  "ABHINAY",
  "MIRAGE",
  "TOOLIKA",
  "ENQUIZTA",
  "SAMWAAD",
  "ZAIKA",
] as const;

export const createScheduleEntrySchema = z.object({
  eventSlug: z
    .string()
    .min(1, "Event slug is required")
    .regex(/^[a-z0-9-]+$/, "Event slug must be lowercase alphanumeric with hyphens"),
  categorySlug: z.enum(EVENT_CATEGORIES, {
    message: "Invalid category",
  }),
  venueSlug: z.string().min(1, "Venue slug is required"),
  day: z.number().int().min(1, "Day must be at least 1"),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be HH:MM format")
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be HH:MM format")
    .optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateScheduleEntrySchema = z.object({
  eventSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  categorySlug: z.enum(EVENT_CATEGORIES).optional(),
  venueSlug: z.string().min(1).optional(),
  day: z.number().int().min(1).optional(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable()
    .optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const scheduleEntryIdParamSchema = z.object({
  scheduleEntryId: z.string().min(1, "Schedule entry ID is required"),
});

// ═══════════════════════════════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════════════════════════════

export const bulkCreateVenuesSchema = z.object({
  venues: z.array(createVenueSchema).min(1, "At least one venue is required"),
});

export const bulkCreateFestDaysSchema = z.object({
  festDays: z.array(createFestDaySchema).min(1, "At least one fest day is required"),
});

export const bulkCreateScheduleEntriesSchema = z.object({
  entries: z.array(createScheduleEntrySchema).min(1, "At least one entry is required"),
});

// ═══════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════

export type CreateVenueSchemaType = z.infer<typeof createVenueSchema>;
export type UpdateVenueSchemaType = z.infer<typeof updateVenueSchema>;
export type CreateFestDaySchemaType = z.infer<typeof createFestDaySchema>;
export type UpdateFestDaySchemaType = z.infer<typeof updateFestDaySchema>;
export type CreateScheduleEntrySchemaType = z.infer<typeof createScheduleEntrySchema>;
export type UpdateScheduleEntrySchemaType = z.infer<typeof updateScheduleEntrySchema>;
