import { Worker, type Job } from "bullmq";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import {
  appendUserRowIfMissing,
  describeSheetsError,
  getMissingSheetsEnvVars,
  isSheetsExportConfigured,
} from "@services/googleSheets/googleSheets.service.js";
import {
  SHEETS_JOB_ATTEMPTS,
  SHEETS_QUEUE_NAME,
  type SheetsJobData,
} from "./sheetsQueue.service.js";

// ═══════════════════════════════════════════════════════════════════
// GOOGLE SHEETS EXPORT WORKER
//
// - concurrency 1: the "check kyId then append" sequence is never run
//   by two jobs at once.
// - limiter 25 jobs / 60s: each job makes 2 Sheets API calls (read +
//   append) and Google allows ~60 requests/min per user per project, so
//   this keeps us under quota. Bursts simply wait in the queue.
// ═══════════════════════════════════════════════════════════════════

const JOBS_PER_MINUTE = 25;

let sheetsWorker: Worker<SheetsJobData> | null = null;

async function processJob(job: Job<SheetsJobData>): Promise<{ result: string }> {
  if (job.data.type !== "user-profile-export") {
    throw new Error(`Unknown sheets job type: ${String((job.data as { type?: unknown }).type)}`);
  }

  const { kyId } = job.data.payload;
  const startedAt = Date.now();

  logger.debug("Processing Sheets export job", {
    jobId: job.id,
    kyId,
    attempt: job.attemptsMade + 1,
    maxAttempts: SHEETS_JOB_ATTEMPTS,
  });

  const result = await appendUserRowIfMissing(job.data.payload);

  logger.info(
    result === "appended"
      ? "User exported to Google Sheet"
      : "User already present in Google Sheet - skipped",
    { jobId: job.id, kyId, result, durationMs: Date.now() - startedAt },
  );

  return { result };
}

export function startSheetsWorker(): Worker<SheetsJobData> | null {
  if (sheetsWorker) {
    logger.warn("Sheets export worker already running");
    return sheetsWorker;
  }

  if (!isSheetsExportConfigured()) {
    logger.error(
      "Google Sheets export DISABLED - required env vars are missing, NO user exports to Google Sheets will happen",
      { missingEnvVars: getMissingSheetsEnvVars() },
    );
    return null;
  }

  sheetsWorker = new Worker<SheetsJobData>(SHEETS_QUEUE_NAME, processJob, {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
    },
    concurrency: 1,
    limiter: { max: JOBS_PER_MINUTE, duration: 60_000 },
  });

  sheetsWorker.on("failed", (job, error) => {
    const attempt = job?.attemptsMade ?? 0;
    const context = {
      jobId: job?.id,
      kyId: job?.data.payload.kyId,
      attempt,
      maxAttempts: SHEETS_JOB_ATTEMPTS,
      ...describeSheetsError(error),
    };

    if (attempt >= SHEETS_JOB_ATTEMPTS) {
      // Retries exhausted: this user is NOT in the sheet. Re-run the backfill script.
      logger.error("Sheets export FAILED permanently - user not exported", context);
    } else {
      logger.warn("Sheets export attempt failed - will retry", context);
    }
  });

  sheetsWorker.on("error", (error) => {
    logger.error("Sheets export worker error", { error: error.message });
  });

  sheetsWorker.on("stalled", (jobId) => {
    logger.warn("Sheets export job stalled", { jobId });
  });

  logger.info("Sheets export worker started", {
    queueName: SHEETS_QUEUE_NAME,
    jobsPerMinute: JOBS_PER_MINUTE,
  });

  return sheetsWorker;
}

export async function stopSheetsWorker(): Promise<void> {
  if (sheetsWorker) {
    await sheetsWorker.close();
    sheetsWorker = null;
    logger.info("Sheets export worker stopped");
  }
}
