/**
 * One-time / repair script: queue every user that already has a kyId
 * (i.e. completed their profile) for export to the Google Sheet.
 *
 * Run with:
 *   npx tsx scripts/backfillSheetsExport.ts --dry-run   # count only, queues nothing
 *   npx tsx scripts/backfillSheetsExport.ts             # queue everyone
 *
 * This script only ENQUEUES jobs. The Sheets worker (started by the API
 * server) does the actual writing, at <= 25 users/minute. Jobs wait in
 * Redis until a server is running, so you can run this before or after
 * starting the server.
 *
 * Safe to re-run: jobs are keyed on kyId and the worker skips any kyId
 * that is already in the sheet. Failed jobs from a previous run are
 * replaced and retried.
 *
 * NOTE: profileCompletedAt for backfilled rows is the user's `updatedAt`,
 * which is only an approximation of when the profile was completed.
 */

import { prisma } from "@root/prisma";
import { logger } from "@logger/logger.js";
import {
  closeSheetsQueue,
  queueUserProfileExport,
} from "@services/queue/index.js";
import {
  getMissingSheetsEnvVars,
  isSheetsExportConfigured,
} from "@services/googleSheets/googleSheets.service.js";

const BATCH_SIZE = 500;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  if (!isSheetsExportConfigured()) {
    logger.error("Backfill aborted - Google Sheets export is NOT configured", {
      missingEnvVars: getMissingSheetsEnvVars(),
    });
    process.exitCode = 1;
    return;
  }

  const total = await prisma.user.count({ where: { kyId: { not: null } } });
  logger.info("Sheets backfill starting", { totalUsersWithKyId: total, dryRun });

  let cursor: string | undefined;
  let seen = 0;
  let queued = 0;
  let failed = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      where: { kyId: { not: null } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        kyId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        college: true,
        isFromIITBhu: true,
        updatedAt: true,
      },
    });

    if (users.length === 0) break;

    for (const user of users) {
      seen++;
      if (!user.kyId) continue;
      if (dryRun) continue;

      try {
        const jobId = await queueUserProfileExport({
          kyId: user.kyId,
          name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
          email: user.email,
          phone: user.phone ?? "",
          college: user.college ?? "",
          isIITBHU: user.isFromIITBhu,
          profileCompletedAt: user.updatedAt.toISOString(),
        });
        if (jobId) queued++;
      } catch (error) {
        failed++;
        logger.error("Backfill: failed to queue user", {
          kyId: user.kyId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    cursor = users[users.length - 1]!.id;
    logger.info("Sheets backfill progress", { seen, queued, failed, total });
  }

  logger.info("Sheets backfill finished", { seen, queued, failed, total, dryRun });
}

main()
  .catch((error) => {
    logger.error("Sheets backfill crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSheetsQueue();
    await prisma.$disconnect();
    // Allow the winston transports to flush before exiting.
    setTimeout(() => process.exit(process.exitCode ?? 0), 1000);
  });
