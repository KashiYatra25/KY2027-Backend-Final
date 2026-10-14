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

export type EmailJobType = "admin-onboard-creds" | "admin-forgot-password" | "account-status-change" | "passes-invoice" | "payment-failed" | "ca-application-status" | "otp" | "welcome";

export interface AdminOnboardCredsEmailJobData {
  type: "admin-onboard-creds";
  payload: {
    userName: string;
    email: string;
    tempPassword: string;
    loginUrl: string;
  };
}

export interface AdminForgotPasswordEmailJobData {
  type: "admin-forgot-password";
  payload: {
    userName: string;
    email: string;
    resetUrl: string;
  };
}

export interface AccountStatusChangeEmailJobData {
  type: "account-status-change";
  payload: {
    userName: string;
    email: string;
    action: "SUSPENDED" | "REACTIVATED";
    reason?: string;
    suspendedByName?: string;
    suspendedByRole?: string;
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

export interface CaApplicationStatusEmailJobData {
  type: "ca-application-status";
  payload: {
    userName: string;
    email: string;
    status: "ACCEPTED" | "REJECTED";
    referralId?: string; // Only for approved
    rejectionReason?: string; // Only for rejected
    dashboardUrl: string;
    websiteUrl: string;
  };
}

export interface PaymentFailedEmailJobData {
  type: "payment-failed";
  payload: {
    userName: string;
    email: string;
    orderId: string;
    totalAmount: number;
    items: Array<{
      passName: string;
      quantity: number;
    }>;
    status: "FAILED" | "EXPIRED" | "TIMEOUT";
    cartUrl: string;
  };
}

// Union type for all email jobs
export type EmailJobData = AdminOnboardCredsEmailJobData | AdminForgotPasswordEmailJobData | AccountStatusChangeEmailJobData | PassesInvoiceEmailJobData | PaymentFailedEmailJobData | CaApplicationStatusEmailJobData;

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
 * Add an admin onboard credentials email job to the queue
 */
export async function queueAdminOnboardCredsEmail(data: AdminOnboardCredsEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "admin-onboard-creds",
    {
      type: "admin-onboard-creds",
      payload: data,
    },
    {
      priority: 1, // High priority for admin emails
    }
  );

  logger.debug("Admin onboard creds email job queued", {
    jobId: job.id,
    email: data.email,
  });

  return job.id!;
}

/**
 * Add a forgot password email job to the queue
 */
export async function queueForgotPasswordEmail(data: AdminForgotPasswordEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "admin-forgot-password",
    {
      type: "admin-forgot-password",
      payload: data,
    },
    {
      priority: 1, // High priority for password reset
    }
  );

  logger.debug("Forgot password email job queued", {
    jobId: job.id,
    email: data.email,
  });

  return job.id!;
}

/**
 * Add an account status change email job to the queue
 */
export async function queueAccountStatusChangeEmail(data: AccountStatusChangeEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "account-status-change",
    {
      type: "account-status-change",
      payload: data,
    },
    {
      priority: 1, // High priority for account status changes
    }
  );

  logger.debug("Account status change email job queued", {
    jobId: job.id,
    email: data.email,
    action: data.action,
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
 * Add a CA application status email job to the queue
 */
export async function queueCaApplicationStatusEmail(data: CaApplicationStatusEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "ca-application-status",
    {
      type: "ca-application-status",
      payload: data,
    },
    {
      priority: 1, // High priority for application status updates
    }
  );

  logger.debug("CA application status email job queued", {
    jobId: job.id,
    email: data.email,
    status: data.status,
  });

  return job.id!;
}

/**
 * Add a payment failed email job to the queue
 */
export async function queuePaymentFailedEmail(data: PaymentFailedEmailJobData["payload"]): Promise<string> {
  const job = await emailQueue.add(
    "payment-failed",
    {
      type: "payment-failed",
      payload: data,
    },
    {
      priority: 1, // High priority for payment notifications
    }
  );

  logger.debug("Payment failed email job queued", {
    jobId: job.id,
    email: data.email,
    orderId: data.orderId,
    status: data.status,
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
