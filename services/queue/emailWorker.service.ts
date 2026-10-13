import { Worker, type Job } from "bullmq";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/logger.js";
import { AdminInviteEmail } from "@email/utils/admin.invite.email.js";
import { ForgotPasswordEmail } from "@email/utils/forgot.password.email.js";
import { AccountStatusChangeEmail } from "@email/utils/account.status.change.email.js";
import { CaApplicationStatusEmail } from "@email/utils/ca.application.status.email.js";
import { InvoiceEmail } from "@email/utils/passes.invoice.email.js";
import { PaymentFailedEmail } from "@email/utils/payment.failed.email.js";
import type { EmailJobData, AdminOnboardCredsEmailJobData, AdminForgotPasswordEmailJobData, AccountStatusChangeEmailJobData, PassesInvoiceEmailJobData, PaymentFailedEmailJobData, CaApplicationStatusEmailJobData } from "./emailQueue.service.js";

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
 * Process admin onboard credentials email
 */
async function processAdminOnboardCredsEmail(data: AdminOnboardCredsEmailJobData["payload"]): Promise<void> {
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

  logger.info("Admin onboard creds email sent", { email });
}

/**
 * Process forgot password email
 */
async function processForgotPasswordEmail(data: AdminForgotPasswordEmailJobData["payload"]): Promise<void> {
  const { userName, email, resetUrl } = data;

  const emailService = new ForgotPasswordEmail(
    { name: userName, email },
    resetUrl
  );

  await emailService.sendEmail(
    "Reset Your Password - Kashiyatra 2027",
    "forgotPassword"
  );

  logger.info("Forgot password email sent", { email });
}

/**
 * Process account status change email
 */
async function processAccountStatusChangeEmail(data: AccountStatusChangeEmailJobData["payload"]): Promise<void> {
  const { userName, email, action, reason, suspendedByName, suspendedByRole } = data;

  const emailService = new AccountStatusChangeEmail(
    { name: userName, email },
    action,
    reason,
    suspendedByName,
    suspendedByRole
  );

  const subject = action === "SUSPENDED" 
    ? "Account Suspended - Kashiyatra 2027"
    : "Account Reactivated - Kashiyatra 2027";

  await emailService.sendEmail(subject, "accountStatusChange");

  logger.info("Account status change email sent", { email, action });
}

/**
 * Process passes invoice email
 */
async function processPassesInvoiceEmail(data: PassesInvoiceEmailJobData["payload"]): Promise<void> {
  const { userName, email, invoiceUrl, orderDetails } = data;

  const emailService = new InvoiceEmail(
    { name: userName, email },
    {
      // template reads {{viewPassUrl}} + invoice fields spread from orderDetails
      viewPassUrl: invoiceUrl,
      ...orderDetails,
    },
  );

  await emailService.sendEmail(
    "Your Kashiyatra 2027 Pass - Invoice",
    "passesInvoice",
  );

  logger.info("Passes invoice email sent", { email });
}

/**
 * Process CA application status email
 */
async function processCaApplicationStatusEmail(data: CaApplicationStatusEmailJobData["payload"]): Promise<void> {
  const { userName, email, status, referralId, rejectionReason, dashboardUrl, websiteUrl } = data;

  const emailService = new CaApplicationStatusEmail(
    { name: userName, email },
    {
      status,
      referralId,
      rejectionReason,
      dashboardUrl,
      websiteUrl,
    }
  );

  const subject = status === "ACCEPTED"
    ? "🎉 Congratulations! You're now a Campus Ambassador - Kashiyatra 2027"
    : "CA Application Update - Kashiyatra 2027";

  await emailService.sendEmail(subject, "caApplicationStatus");

  logger.info("CA application status email sent", { email, status });
}

/**
 * Process payment failed email
 */
async function processPaymentFailedEmail(data: PaymentFailedEmailJobData["payload"]): Promise<void> {
  const { userName, email, orderId, totalAmount, items, status, cartUrl } = data;

  const emailService = new PaymentFailedEmail(
    { name: userName, email },
    {
      orderId,
      totalAmount,
      items,
      status,
      cartUrl,
    }
  );

  const subject = status === "EXPIRED"
    ? "Payment Session Expired - Kashiyatra 2027"
    : "Payment Failed - Kashiyatra 2027";

  await emailService.sendEmail(subject, "paymentFailed");

  logger.info("Payment failed email sent", { email, orderId, status });
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
    case "admin-onboard-creds":
      await processAdminOnboardCredsEmail(payload as AdminOnboardCredsEmailJobData["payload"]);
      break;

    case "admin-forgot-password":
      await processForgotPasswordEmail(payload as AdminForgotPasswordEmailJobData["payload"]);
      break;

    case "account-status-change":
      await processAccountStatusChangeEmail(payload as AccountStatusChangeEmailJobData["payload"]);
      break;

    case "passes-invoice":
      await processPassesInvoiceEmail(payload as PassesInvoiceEmailJobData["payload"]);
      break;

    case "ca-application-status":
      await processCaApplicationStatusEmail(payload as CaApplicationStatusEmailJobData["payload"]);
      break;

    case "payment-failed":
      await processPaymentFailedEmail(payload as PaymentFailedEmailJobData["payload"]);
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
