import { Queue, type JobsOptions } from "bullmq";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// EMAIL QUEUE SERVICE
// 
// BullMQ queue for async email sending with automatic retries.
// Uses Redis as the backing store.
//
// Benefits:
// - API responds instantly (doesn't wait for email)
// - Automatic retries with exponential backoff
// - Failed jobs are tracked
// - Can scale with multiple workers
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// JOB TYPES
// ═══════════════════════════════════════════════════════════════════

export type EmailJobType = "admin-invite" | "passes-invoice" | "otp" | "welcome";

export interface AdminInviteEmailJobData {
  type: "admin-invite";
  payload: {
    userName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
  };
}

export interface PassesInvoiceEmailJobData {
  type: "passes-invoice";
  payload: {
    userName: string;
    email: string;
    invoiceUrl: string;
    orderDetails: Record<string, unknown>;
  };
}

// Union type for all email jobs
export type EmailJobData = AdminInviteEmailJobData | PassesInvoiceEmailJobData;

// ═══════════════════════════════════════════════════════════════════
// QUEUE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const QUEUE_NAME = "email-queue";

// Default job options
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000, // Start with 2s, then 4s, then 8s
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs for debugging
    age: 24 * 60 * 60, // Remove completed jobs older than 24 hours
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs for analysis
    age: 7 * 24 * 60 * 60, // Remove failed jobs older than 7 days
  },
};

// ═══════════════════════════════════════════════════════════════════
// QUEUE INSTANCE
// ═══════════════════════════════════════════════════════════════════

const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  defaultJobOptions,
});

// Log queue events
emailQueue.on("error", (error) => {
  logger.error("Email queue error", { error: error.message });
});

logger.info("Email queue initialized", { queueName: QUEUE_NAME });

// ═══════════════════════════════════════════════════════════════════
// QUEUE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Add an admin invite email job to the queue
 */
export async function queueAdminInviteEmail(data: AdminInviteEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "admin-invite",
    {
      type: "admin-invite",
      payload: data,
    },
    {
      priority: 1, // High priority for admin emails
    }
  );

  logger.debug("Admin invite email job queued", {
    jobId: job.id,
    email: data.email,
  });

  return job.id!;
}

/**
 * Add a passes invoice email job to the queue
 */
export async function queuePassesInvoiceEmail(data: PassesInvoiceEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "passes-invoice",
    {
      type: "passes-invoice",
      payload: data,
    },
    {
      priority: 2, // Normal priority
    }
  );

  logger.debug("Passes invoice email job queued", {
    jobId: job.id,
    email: data.email,
  });

  return job.id!;
}

/**
 * Get queue stats for monitoring
 */
export async function getEmailQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Graceful shutdown
 */
export async function closeEmailQueue(): Promise<void> {
  await emailQueue.close();
  logger.info("Email queue closed");
}

export { emailQueue };
