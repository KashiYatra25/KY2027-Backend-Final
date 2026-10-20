import { prisma } from "@root/prisma";
import { PurchaseModel } from "@root/databaseManagers/mongoose";
import { logger } from "@root/lib/logger/logger";

// ═══════════════════════════════════════════════════════════════════
// RECONCILE isPaidUser STATUS
// 
// This script ensures consistency between:
// - MongoDB Purchase collection (source of truth for payments)
// - PostgreSQL User.isPaidUser flag (cached status for fast queries)
//
// Run manually or via cron: npx tsx scripts/reconcilePaidStatus.script.ts
// Recommended: Run hourly during festival, daily otherwise
//
// Safe to run multiple times - idempotent operation.
// ═══════════════════════════════════════════════════════════════════

interface ReconciliationResult {
  totalPurchases: number;
  uniqueUsers: number;
  alreadyCorrect: number;
  fixed: number;
  failed: string[];
}

async function reconcilePaidStatus(): Promise<ReconciliationResult> {
  console.log("═".repeat(60));
  console.log("🔄 Starting isPaidUser reconciliation...");
  console.log("═".repeat(60));

  const result: ReconciliationResult = {
    totalPurchases: 0,
    uniqueUsers: 0,
    alreadyCorrect: 0,
    fixed: 0,
    failed: [],
  };

  try {
    // Step 1: Get all verified purchases with matched users
    const verifiedPurchases = await PurchaseModel.find({
      userId: { $ne: "UNMATCHED", $exists: true },
      status: "VERIFIED",
    }).select("userId").lean();

    result.totalPurchases = verifiedPurchases.length;

    // Step 2: Get unique user IDs
    const userIds = [...new Set(verifiedPurchases.map(p => p.userId))];
    result.uniqueUsers = userIds.length;

    console.log(`📊 Found ${result.totalPurchases} verified purchases for ${result.uniqueUsers} unique users`);

    if (userIds.length === 0) {
      console.log("✅ No purchases to reconcile");
      return result;
    }

    // Step 3: Find users who should be paid but aren't marked as such
    const usersNotMarkedPaid = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        isPaidUser: false,
      },
      select: { id: true, email: true },
    });

    result.alreadyCorrect = result.uniqueUsers - usersNotMarkedPaid.length;

    if (usersNotMarkedPaid.length === 0) {
      console.log("✅ All users already correctly marked as paid");
      return result;
    }

    console.log(`⚠️  Found ${usersNotMarkedPaid.length} users needing reconciliation`);

    // Step 4: Fix each user
    for (const user of usersNotMarkedPaid) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { isPaidUser: true },
        });

        result.fixed++;

        logger.info({
          msg: "RECONCILED: User isPaidUser fixed",
          userId: user.id,
          userEmail: user.email,
        });

        console.log(`  ✅ Fixed: ${user.email}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.failed.push(`${user.id}: ${errorMsg}`);

        logger.error({
          msg: "RECONCILE_FAILED: Could not update isPaidUser",
          userId: user.id,
          userEmail: user.email,
          error: errorMsg,
        });

        console.log(`  ❌ Failed: ${user.email} - ${errorMsg}`);
      }
    }

    // Summary
    console.log("");
    console.log("═".repeat(60));
    console.log("📋 Reconciliation Summary");
    console.log("═".repeat(60));
    console.log(`Total verified purchases: ${result.totalPurchases}`);
    console.log(`Unique users with purchases: ${result.uniqueUsers}`);
    console.log(`Already correct: ${result.alreadyCorrect}`);
    console.log(`Fixed: ${result.fixed}`);
    console.log(`Failed: ${result.failed.length}`);

    if (result.failed.length > 0) {
      console.log("\n❌ Failed users:");
      result.failed.forEach(f => console.log(`   ${f}`));
    }

    console.log("═".repeat(60));

    return result;

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({
      msg: "RECONCILE_SCRIPT_ERROR: Fatal error during reconciliation",
      error: errorMsg,
    });
    console.error("❌ Fatal error:", errorMsg);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Also reconcile IIT BHU users who should have free passes
// ═══════════════════════════════════════════════════════════════════

async function reconcileIITBhuUsers(): Promise<{ fixed: number }> {
  console.log("");
  console.log("🎓 Checking IIT BHU users...");

  // IIT BHU users with verified identity should be marked as paid
  const iitBhuUsersNotPaid = await prisma.user.findMany({
    where: {
      isFromIITBhu: true,
      isPaidUser: false,
    },
    select: { id: true, email: true },
  });

  if (iitBhuUsersNotPaid.length === 0) {
    console.log("✅ All IIT BHU users correctly marked as paid");
    return { fixed: 0 };
  }

  console.log(`⚠️  Found ${iitBhuUsersNotPaid.length} IIT BHU users not marked as paid`);

  let fixed = 0;
  for (const user of iitBhuUsersNotPaid) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { isPaidUser: true },
      });
      fixed++;
      console.log(`  ✅ Fixed IIT BHU user: ${user.email}`);
    } catch (err) {
      console.log(`  ❌ Failed IIT BHU user: ${user.email}`);
    }
  }

  return { fixed };
}

// ═══════════════════════════════════════════════════════════════════
// Main execution
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  try {
    // Run both reconciliations
    await reconcilePaidStatus();
    await reconcileIITBhuUsers();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Completed in ${duration}s`);

  } catch (err) {
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
