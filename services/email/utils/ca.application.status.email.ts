import { Email } from "@email/base.js";
import { type IUser } from "@email/types/email.types.js";

// ═══════════════════════════════════════════════════════════════════
// CA APPLICATION STATUS EMAIL
//
// Sends email notification when a CA application is approved or rejected.
// Uses the caApplicationStatus.handlebars template.
// ═══════════════════════════════════════════════════════════════════

export interface CaApplicationStatusEmailData {
  status: "ACCEPTED" | "REJECTED";
  referralId?: string; // Only for approved applications
  rejectionReason?: string; // Only for rejected applications
  dashboardUrl: string;
  websiteUrl: string;
}

export class CaApplicationStatusEmail extends Email {
  private status: "ACCEPTED" | "REJECTED";
  private referralId?: string;
  private rejectionReason?: string;
  private dashboardUrl: string;
  private websiteUrl: string;

  constructor(user: IUser, data: CaApplicationStatusEmailData) {
    super(user);
    this.status = data.status;
    this.referralId = data.referralId;
    this.rejectionReason = data.rejectionReason;
    this.dashboardUrl = data.dashboardUrl;
    this.websiteUrl = data.websiteUrl;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      email: this.to,
      isApproved: this.status === "ACCEPTED",
      isRejected: this.status === "REJECTED",
      referralId: this.referralId,
      rejectionReason: this.rejectionReason || "No reason provided",
      dashboardUrl: this.dashboardUrl,
      websiteUrl: this.websiteUrl,
    });
  }
}
