import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class AccountStatusChangeEmail extends Email {
  private action: "SUSPENDED" | "REACTIVATED";
  private reason?: string;
  private suspendedByName?: string;
  private suspendedByRole?: string;

  constructor(
    user: IUser, 
    action: "SUSPENDED" | "REACTIVATED",
    reason?: string,
    suspendedByName?: string,
    suspendedByRole?: string
  ) {
    super(user);
    this.action = action;
    this.reason = reason;
    this.suspendedByName = suspendedByName;
    this.suspendedByRole = suspendedByRole;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      email: this.to,
      action: this.action,
      isSuspended: this.action === "SUSPENDED",
      isReactivated: this.action === "REACTIVATED",
      reason: this.reason || "No reason provided",
      suspendedByName: this.suspendedByName || "Admin",
      suspendedByRole: this.suspendedByRole || "Administrator",
    });
  }
}
