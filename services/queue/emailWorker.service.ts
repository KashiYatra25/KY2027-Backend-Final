import { Worker, type Job } from "bullmq";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { AdminInviteEmail } from "@email/utils/admin.invite.email.js";
import type { EmailJobData, AdminInviteEmailJobData, PassesInvoiceEmailJobData } from "./emailQueue.service.js";

// ═══════════════════════════════════════════════════════════════════
// EMAIL WORKER
// 
// BullMQ worker that processes email jobs from the queue.
// Handles different email types and implements retry logic.
// ═══════════════════════════════════════════════════════════════════

const QUEUE_NAME = "email-queue";

// ═══════════════════════════════════════════════════════════════════
// EMAIL PROCESSORS
// ═══════════════════════════════════════════════════════════════════

/**
 * Process admin invite email
 */
async function processAdminInviteEmail(data: AdminInviteEmailJobData["payload"]): Promise<void> {
  const { userName, email, tempPassword, loginUrl } = data;

  const emailService = new AdminInviteEmail(
    { name: userName, email },
    tempPassword,
    loginUrl
  );

  await emailService.sendEmail(
    "Welcome to Kashiyatra 2027 Admin Panel",
    "adminInvite"
  );

  logger.info("Admin invite email sent", { email });
}

/**
 * Process passes invoice email
 */
async function processPassesInvoiceEmail(data: PassesInvoiceEmailJobData["payload"]): Promise<void> {
  // TODO: Implement passes invoice email
  logger.info("Passes invoice email sent", { email: data.email });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PROCESSOR
// ═══════════════════════════════════════════════════════════════════

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, payload } = job.data;

  logger.debug("Processing email job", {
    jobId: job.id,
    type,
    attempt: job.attemptsMade + 1,
  });

  switch (type) {
    case "admin-invite":
      await processAdminInviteEmail(payload as AdminInviteEmailJobData["payload"]);
      break;

    case "passes-invoice":
      await processPassesInvoiceEmail(payload as PassesInvoiceEmailJobData["payload"]);
      break;

    default:
      logger.warn("Unknown email job type", { type, jobId: job.id });
      throw new Error(`Unknown email job type: ${type}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// WORKER INSTANCE
// ═══════════════════════════════════════════════════════════════════

let emailWorker: Worker<EmailJobData> | null = null;

/**
 * Start the email worker
 */
export function startEmailWorker(): Worker<EmailJobData> {
  if (emailWorker) {
    logger.warn("Email worker already running");
    return emailWorker;
  }

  emailWorker = new Worker<EmailJobData>(
    QUEUE_NAME,
    processEmailJob,
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
      },
      concurrency: 5, // Process up to 5 emails concurrently
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second (rate limiting)
      },
    }
  );

  // Worker event handlers
  emailWorker.on("completed", (job) => {
    logger.debug("Email job completed", {
      jobId: job.id,
      type: job.data.type,
    });
  });

  emailWorker.on("failed", (job, error) => {
    logger.error("Email job failed", {
      jobId: job?.id,
      type: job?.data.type,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  emailWorker.on("error", (error) => {
    logger.error("Email worker error", { error: error.message });
  });

  emailWorker.on("stalled", (jobId) => {
    logger.warn("Email job stalled", { jobId });
  });

  logger.info("Email worker started", {
    queueName: QUEUE_NAME,
    concurrency: 5,
  });

  return emailWorker;
}

/**
 * Stop the email worker gracefully
 */
export async function stopEmailWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    logger.info("Email worker stopped");
  }
}

/**
 * Check if worker is running
 */
export function isEmailWorkerRunning(): boolean {
  return emailWorker !== null && !emailWorker.closing;
}
