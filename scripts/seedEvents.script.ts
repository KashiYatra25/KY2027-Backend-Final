/**
 * Seed script for events
 * Run with: pnpm seed:events
 */

import { prisma } from "@root/prisma.js";
import { eventsData } from "./data/events.data.js";

async function seedEvents() {
  console.log("🌱 Starting events seed...\n");

  try {
    // Clear existing events
    const deleteResult = await prisma.event.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.count} existing events\n`);

    // Insert new events
    const insertResult = await prisma.event.createMany({
      data: eventsData,
    });
    console.log(`✨ Inserted ${insertResult.count} events:\n`);

    // Fetch and display inserted events grouped by category
    const events = await prisma.event.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    let currentCategory = "";
    for (const event of events) {
      if (event.category !== currentCategory) {
        currentCategory = event.category;
        console.log(`\n   📁 ${currentCategory}`);
      }
      console.log(`      - ${event.name} (${event.slug}) [${event.participationType}]`);
    }

    console.log("\n✅ Events seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding events:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("\n📤 Database disconnected");
    process.exit(0);
  }
}

// Run the seed
seedEvents();
