/**
 * Seed Script for Schedule Data
 * Run with: npx tsx scripts/seedSchedule.ts
 *
 * Seeds venues, fest days, and schedule entries from the hardcoded frontend config
 */

import { connInstance } from "@lib/mongo/connection.js";
import {
  VenueModel,
  FestDayModel,
  ScheduleEntryModel,
} from "@lib/mongo/index.js";

// ═══════════════════════════════════════════════════════════════════
// VENUES DATA (from frontend campusMap.config.ts)
// ═══════════════════════════════════════════════════════════════════

const VENUES_DATA = [
  {
    slug: "sergovardhanpur-gate",
    name: "Sergovardhanpur Gate",
    label: "Sergovardhanpur Gate",
    tone: "white",
    x: 61.5,
    y: 2.8,
    anchorX: 52,
    anchorY: 3.2,
    clickable: true,
    active: true,
    sortOrder: 0,
  },
  {
    slug: "lt-4",
    name: "LT-4",
    label: "LT-4",
    tone: "blue",
    large: true,
    x: 59.5,
    y: 8.5,
    anchorX: 58.9,
    anchorY: 13.6,
    clickable: true,
    active: true,
    sortOrder: 1,
  },
  {
    slug: "lt-3",
    name: "LT-3",
    label: "LT-3",
    tone: "blue",
    large: true,
    x: 68.5,
    y: 16.5,
    anchorX: 67.4,
    anchorY: 22.3,
    clickable: true,
    active: true,
    sortOrder: 2,
  },
  {
    slug: "sb",
    name: "Swatantrata Bhawan",
    label: "SB",
    tone: "blue",
    large: true,
    x: 37,
    y: 17.5,
    anchorX: 35.5,
    anchorY: 22.3,
    clickable: true,
    active: true,
    sortOrder: 3,
  },
  {
    slug: "main-building",
    name: "Electrical Engineering (Main Building)",
    label: "Electrical Engineering\n(Main Building)",
    tone: "red",
    large: true,
    x: 33,
    y: 31.5,
    anchorX: 33.2,
    anchorY: 39.3,
    clickable: true,
    active: true,
    sortOrder: 4,
  },
  {
    slug: "lt-2",
    name: "LT-2",
    label: "LT-2",
    tone: "blue",
    large: true,
    x: 15,
    y: 34,
    anchorX: 24.3,
    anchorY: 37.4,
    clickable: true,
    active: true,
    sortOrder: 5,
  },
  {
    slug: "lt-1",
    name: "LT-1",
    label: "LT-1",
    tone: "blue",
    large: true,
    x: 49,
    y: 41.5,
    anchorX: 48,
    anchorY: 46.4,
    clickable: true,
    active: true,
    sortOrder: 6,
  },
  {
    slug: "adv-ground",
    name: "ADV Ground",
    label: "ADV Ground",
    tone: "green",
    large: true,
    x: 72,
    y: 41.5,
    anchorX: 70,
    anchorY: 49.5,
    clickable: true,
    active: true,
    sortOrder: 7,
  },
  {
    slug: "gymkhana-ground",
    name: "Gymkhana Ground",
    label: "GYMKHANA GROUND",
    tone: "green",
    x: 57,
    y: 55.5,
    anchorX: 58.6,
    anchorY: 62.5,
    clickable: true,
    active: true,
    sortOrder: 8,
  },
  {
    slug: "rajputana-ground",
    name: "Rajputana Ground",
    label: "RAJPUTANA GROUND",
    tone: "green",
    x: 43.5,
    y: 62.5,
    anchorX: 42.8,
    anchorY: 69,
    clickable: true,
    active: true,
    sortOrder: 9,
  },
  {
    slug: "sac",
    name: "Student Activity Centre",
    label: "SAC",
    tone: "blue",
    large: true,
    x: 30,
    y: 58.5,
    anchorX: 29.4,
    anchorY: 64.2,
    clickable: true,
    active: true,
    sortOrder: 10,
  },
  {
    slug: "vishwanath-temple",
    name: "Vishwanath Temple",
    label: "Vishwanath Temple",
    tone: "red",
    x: 8.2,
    y: 55.5,
    anchorX: 8.2,
    anchorY: 59,
    clickable: true,
    active: true,
    sortOrder: 11,
  },
  {
    slug: "towards-temple",
    name: "Way towards B-09, B-10 and Vishwanath Temple",
    label: "Way towards\nB-09 and B-10\nand\nVishwanath Temple →",
    tone: "text",
    x: 7.5,
    y: 46.5,
    clickable: false,
    active: true,
    sortOrder: 12,
  },
  {
    slug: "entry",
    name: "Entry to IIT (BHU)",
    label: "Entry to\nIIT (BHU)",
    tone: "blue",
    large: true,
    x: 15.5,
    y: 71.5,
    clickable: true,
    active: true,
    sortOrder: 13,
  },
  {
    slug: "rajputana-crossing",
    name: "Rajputana Crossing",
    label: "Rajputana\nCrossing",
    tone: "white",
    x: 21.5,
    y: 78.5,
    clickable: true,
    active: true,
    sortOrder: 14,
  },
  {
    slug: "pc-ray-satish-dhawan-hostels",
    name: "PC Ray and Satish Dhawan Hostels",
    label: "PC RAY AND\nSATISH DHAWAN\nHOSTELS",
    tone: "blue",
    x: 7.5,
    y: 82,
    anchorX: 15.5,
    anchorY: 86,
    clickable: true,
    active: true,
    sortOrder: 15,
  },
  {
    slug: "girls-hostels",
    name: "Girls Hostels",
    label: "GIRLS HOSTELS",
    tone: "blue",
    x: 47,
    y: 77.5,
    anchorX: 37,
    anchorY: 82,
    clickable: true,
    active: true,
    sortOrder: 16,
  },
  {
    slug: "chiron-hyderabad-gate",
    name: "Chiron Hyderabad Gate",
    label: "Chiron\nHyderabad Gate",
    tone: "white",
    x: 71,
    y: 95.5,
    anchorX: 66,
    anchorY: 90.6,
    clickable: true,
    active: true,
    sortOrder: 17,
  },
];

// ═══════════════════════════════════════════════════════════════════
// FEST DAYS DATA
// ═══════════════════════════════════════════════════════════════════

const FEST_DAYS_DATA = [
  {
    dayNumber: 1,
    date: new Date("2027-01-14"),
    displayDate: "14 Jan",
    name: "Opening Day",
    active: true,
  },
  {
    dayNumber: 2,
    date: new Date("2027-01-15"),
    displayDate: "15 Jan",
    name: null,
    active: true,
  },
  {
    dayNumber: 3,
    date: new Date("2027-01-16"),
    displayDate: "16 Jan",
    name: null,
    active: true,
  },
  {
    dayNumber: 4,
    date: new Date("2027-01-17"),
    displayDate: "17 Jan",
    name: "Grand Finale",
    active: true,
  },
];

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE ENTRIES DATA (from frontend campusMap.config.ts SCHEDULE)
// Format: [categorySlug, eventSlug, venueSlug, day]
// ═══════════════════════════════════════════════════════════════════

// Reconciled to the real event slugs in scripts/data/events.data.ts.
// Every entry references an existing Prisma Event slug (no orphans).
const SCHEDULE_DATA: [string, string, string, number][] = [
  // NATRAJ (dance)
  ["NATRAJ", "cut-a-rug", "sb", 1],
  ["NATRAJ", "sync-or-sink", "sac", 2],
  ["NATRAJ", "footloose", "gymkhana-ground", 3],
  // CROSSWINDZ (music)
  ["CROSSWINDZ", "sur-sangam", "sb", 2],
  ["CROSSWINDZ", "battle-of-bands", "rajputana-ground", 2],
  ["CROSSWINDZ", "instrumental-solo", "sac", 3],
  // BANDISH (classical)
  ["BANDISH", "raag-rang", "sb", 1],
  ["BANDISH", "taal-vadya", "sb", 2],
  ["BANDISH", "nritya-natya", "sb", 4],
  // ABHINAY (theatre)
  ["ABHINAY", "mono-act", "lt-1", 1],
  ["ABHINAY", "nukkad-natak", "adv-ground", 2],
  ["ABHINAY", "stage-play", "sb", 3],
  // MIRAGE (fashion/personality)
  ["MIRAGE", "runway-revolution", "rajputana-ground", 1],
  ["MIRAGE", "mr-and-ms-ky", "sac", 4],
  // TOOLIKA (art)
  ["TOOLIKA", "canvas-clash", "main-building", 1],
  ["TOOLIKA", "sketch-storm", "main-building", 2],
  ["TOOLIKA", "digital-dreams", "lt-3", 2],
  // ENQUIZTA (quiz)
  ["ENQUIZTA", "general-quiz", "lt-2", 1],
  ["ENQUIZTA", "biz-quiz", "lt-2", 2],
  ["ENQUIZTA", "tech-trivia", "lt-4", 3],
  // SAMWAAD (literary)
  ["SAMWAAD", "debate", "lt-3", 1],
  ["SAMWAAD", "poetry-slam", "lt-1", 2],
  ["SAMWAAD", "creative-writing", "lt-3", 3],
  // ZAIKA (culinary)
  ["ZAIKA", "masterchef-ky", "adv-ground", 1],
  ["ZAIKA", "mocktail-madness", "adv-ground", 4],
];

// ═══════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function seedVenues() {
  console.log("🏛️  Seeding venues...");

  // Clear existing
  await VenueModel.deleteMany({});

  // Insert new
  const result = await VenueModel.insertMany(VENUES_DATA);
  console.log(`   ✓ Inserted ${result.length} venues`);

  return result;
}

async function seedFestDays() {
  console.log("📅 Seeding fest days...");

  // Clear existing
  await FestDayModel.deleteMany({});

  // Insert new
  const result = await FestDayModel.insertMany(FEST_DAYS_DATA);
  console.log(`   ✓ Inserted ${result.length} fest days`);

  return result;
}

async function seedScheduleEntries(venueMap: Map<string, string>) {
  console.log("📋 Seeding schedule entries...");

  // Clear existing
  await ScheduleEntryModel.deleteMany({});

  // Build schedule entries
  const entries = SCHEDULE_DATA.map(([categorySlug, eventSlug, venueSlug, day], index) => ({
    eventSlug,
    categorySlug,
    venueSlug,
    venueId: venueMap.get(venueSlug),
    day,
    active: true,
    sortOrder: index,
  }));

  // Insert new
  const result = await ScheduleEntryModel.insertMany(entries);
  console.log(`   ✓ Inserted ${result.length} schedule entries`);

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n🌱 Starting schedule data seed...\n");

  try {
    // Wait a moment for MongoDB connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("📦 MongoDB connection ready\n");

    // Seed venues first
    const venues = await seedVenues();

    // Create venue slug -> _id map
    const venueMap = new Map<string, string>();
    venues.forEach((v) => {
      venueMap.set(v.slug, v._id.toString());
    });

    // Seed fest days
    await seedFestDays();

    // Seed schedule entries
    await seedScheduleEntries(venueMap);

    console.log("\n✅ Seed completed successfully!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

main();
