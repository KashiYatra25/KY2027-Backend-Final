// Queue Service Exports
export {
  emailQueue,
  queueAdminOnboardCredsEmail,
  queueForgotPasswordEmail,
  queueAccountStatusChangeEmail,
  queuePassesInvoiceEmail,
  queueCaApplicationStatusEmail,
  getEmailQueueStats,
  closeEmailQueue,
  type EmailJobData,
  type AdminOnboardCredsEmailJobData,
  type AdminForgotPasswordEmailJobData,
  type AccountStatusChangeEmailJobData,
  type PassesInvoiceEmailJobData,
  type CaApplicationStatusEmailJobData,
} from "./emailQueue.service.js";

export {
  startEmailWorker,
  stopEmailWorker,
  isEmailWorkerRunning,
} from "./emailWorker.service.js";
