/**
 * Seed script for events
 * Run with: pnpm seed:events
 */

import { prisma } from "@root/prisma.js";
import { eventsData } from "./data/events.data.js";
import { redisService } from "@redis/index.js";
import { bumpEventsCacheVersion } from "@redis/eventsCache.service.js";
import { bumpScheduleCacheVersion } from "@redis/scheduleCache.service.js";

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

    // Invalidate all event caches (and the schedule cache, which embeds event
    // data) so the re-seeded data is served immediately rather than after TTL.
    await bumpEventsCacheVersion();
    await bumpScheduleCacheVersion();
    console.log("\n♻️  Bumped events + schedule cache versions (caches invalidated)");

    console.log("\n✅ Events seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding events:", error);
    await prisma.$disconnect();
    await redisService.gracefulShutdown();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await redisService.gracefulShutdown();
    console.log("\n📤 Database disconnected");
    process.exit(0);
  }
}

// Run the seed
seedEvents();
