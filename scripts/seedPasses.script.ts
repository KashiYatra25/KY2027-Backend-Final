/**
 * Seed script for passes
 * Run with: pnpm seed:passes
 */

import mongoose from "mongoose";
import { PassModel } from "@root/databaseManagers/mongoose/index.js";
import { passesData } from "./data/passes.data.js";

async function seedPasses() {
  console.log("🌱 Starting passes seed...\n");

  try {
    // Wait for MongoDB connection to be ready
    await new Promise<void>((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once("open", () => resolve());
      }
    });
    console.log("✅ MongoDB connected\n");

    // Clear existing passes
    const deleteResult = await PassModel.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing passes\n`);

    // Insert new passes
    const insertResult = await PassModel.insertMany(passesData);
    console.log(`✨ Inserted ${insertResult.length} passes:\n`);

    for (const pass of insertResult) {
      console.log(`   - ${pass.name} (${pass.slug}) - ₹${pass.price}`);
    }

    console.log("\n✅ Passes seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding passes:", error);
    process.exit(1);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("\n📤 MongoDB disconnected");
    process.exit(0);
  }
}

// Run the seed
seedPasses();
