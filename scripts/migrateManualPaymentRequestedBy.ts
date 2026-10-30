/**
 * One-time migration script to ensure all ManualPaymentRequest documents
 * have `requestedBy` set to admin email (not adminId).
 * 
 * Run with: npx tsx scripts/migrateManualPaymentRequestedBy.ts
 * 
 * This is needed because:
 * - createManualPaymentRequest stores requestedBy = admin email
 * - getMyPaymentRequests queries by requestedBy = admin email
 * - If any old records have adminId instead of email, they won't match
 */

import { prisma } from "@root/prisma";
import { ManualPaymentRequestModel } from "@root/databaseManagers/mongoose";
import mongoose from "mongoose";

async function migrate() {
  console.log("🔄 Starting ManualPaymentRequest requestedBy migration...\n");

  // MongoDB connection is auto-initialized when models are accessed
  console.log("✅ MongoDB connection ready\n");

  // Get all manual payment requests
  const requests = await ManualPaymentRequestModel.find({}).lean();
  console.log(`📊 Found ${requests.length} manual payment request(s)\n`);

  if (requests.length === 0) {
    console.log("✅ No records to migrate. Done!");
    await mongoose.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }

  // Check each request
  let needsMigration = 0;
  let alreadyCorrect = 0;
  const updates: Array<{ requestId: string; oldValue: string; newValue: string }> = [];

  for (const request of requests) {
    const requestedBy = request.requestedBy;

    // Check if it looks like an email
    const isEmail = requestedBy.includes("@");

    if (isEmail) {
      alreadyCorrect++;
      console.log(`  ✓ ${request.requestId}: "${requestedBy}" (already email)`);
    } else {
      // Looks like an adminId (UUID), need to find the email
      console.log(`  ⚠ ${request.requestId}: "${requestedBy}" (looks like adminId, needs migration)`);
      
      // Try to find the admin by ID in Prisma, then get their email from User
      const admin = await prisma.admin.findUnique({
        where: { id: requestedBy },
        include: { user: { select: { email: true } } },
      });

      if (admin?.user?.email) {
        updates.push({
          requestId: request.requestId,
          oldValue: requestedBy,
          newValue: admin.user.email,
        });
        needsMigration++;
        console.log(`    → Found admin email: ${admin.user.email}`);
      } else {
        console.log(`    ❌ Could not find admin with ID: ${requestedBy}`);
        console.log(`       This record may need manual review.`);
      }
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   - Already correct (email): ${alreadyCorrect}`);
  console.log(`   - Needs migration: ${needsMigration}`);
  console.log(`   - Total: ${requests.length}\n`);

  if (updates.length === 0) {
    console.log("✅ No migration needed. All records are correct!");
    await mongoose.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  }

  // Perform updates
  console.log("🔧 Performing updates...\n");
  
  for (const update of updates) {
    await ManualPaymentRequestModel.updateOne(
      { requestId: update.requestId },
      { $set: { requestedBy: update.newValue } }
    );
    console.log(`  ✓ Updated ${update.requestId}: "${update.oldValue}" → "${update.newValue}"`);
  }

  console.log(`\n✅ Migration complete! Updated ${updates.length} record(s).`);

  await mongoose.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
