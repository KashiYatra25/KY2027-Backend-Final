import { Queue, type JobsOptions } from "bullmq";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import {
  getMissingSheetsEnvVars,
  isSheetsExportConfigured,
  type UserSheetRow,
} from "@services/googleSheets/googleSheets.service.js";

// ═══════════════════════════════════════════════════════════════════
// GOOGLE SHEETS EXPORT QUEUE
//
// BullMQ queue (Redis-backed) that appends completed user profiles to a
// Google Sheet asynchronously. Mirrors the email queue so the API never
// waits on Google, and Google rate limits / outages are absorbed by
// retries with exponential backoff.
//
// Deduplication: jobId = "sheet-export-<kyId>", so a user cannot be queued
// twice at the same time. The worker also checks the sheet itself before
// appending, which covers the case where an old job has been cleaned up.
// ═══════════════════════════════════════════════════════════════════

export const SHEETS_QUEUE_NAME = "sheets-export-queue";

export interface UserProfileExportJobData {
  type: "user-profile-export";
  payload: UserSheetRow;
}

export type SheetsJobData = UserProfileExportJobData;

export const SHEETS_JOB_ATTEMPTS = 6;

const defaultJobOptions: JobsOptions = {
  attempts: SHEETS_JOB_ATTEMPTS,
  backoff: {
    type: "exponential",
    delay: 5000, // 5s, 10s, 20s, 40s, 80s - rides out Sheets API rate limiting
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 60 * 60,
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 60 * 60, // keep failures a week so they can be inspected / re-driven
  },
};

export const sheetsQueue = new Queue<SheetsJobData>(SHEETS_QUEUE_NAME, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    username: env.REDIS_USERNAME,
    password: env.REDIS_PASSWORD,
  },
  defaultJobOptions,
});

sheetsQueue.on("error", (error) => {
  logger.error("Sheets export queue error", { error: error.message });
});

export function sheetsJobId(kyId: string): string {
  return `sheet-export-${kyId}`;
}

/**
 * Queue a completed-profile row for export.
 *
 * Returns the job id, or null when nothing was queued (exports not
 * configured). When exports are not configured this logs an ERROR with the
 * kyId so the skipped user can be found and backfilled later.
 */
export async function queueUserProfileExport(row: UserSheetRow): Promise<string | null> {
  if (!isSheetsExportConfigured()) {
    logger.error("Google Sheets export skipped - exports are NOT configured, user will not be exported", {
      kyId: row.kyId,
      missingEnvVars: getMissingSheetsEnvVars(),
    });
    return null;
  }

  const jobId = sheetsJobId(row.kyId);

  // A previously FAILED job with the same id would make add() a silent no-op.
  // Replace it so re-queueing (e.g. from the backfill script) actually retries.
  const existing = await sheetsQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      await existing.remove();
      logger.info("Removed failed Sheets export job before re-queueing", { kyId: row.kyId, jobId });
    }
  }

  const job = await sheetsQueue.add(
    "user-profile-export",
    { type: "user-profile-export", payload: row },
    { jobId },
  );

  logger.info("Sheets export job queued", { kyId: row.kyId, jobId: job.id });
  return job.id ?? jobId;
}

export async function closeSheetsQueue(): Promise<void> {
  await sheetsQueue.close();
  logger.info("Sheets export queue closed");
}
