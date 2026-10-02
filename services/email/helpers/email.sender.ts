import { GenerateUrlAndSendEmail } from "@email/helpers/emailWithUrl.helper.js";
import { env } from "@lib/env/environment.js";
import { type NextFunction } from "express";
import { WelcomeEmail } from "@email/utils/welcome.email.js";
import { InvoiceEmail } from "@email/utils/invoice.email.js";
import { AdminInviteEmail } from "@email/utils/adminInvite.email.js";
import { type IUser } from "@email/types/email.types.js";

export class SendWelcomeEmail extends GenerateUrlAndSendEmail {
  constructor(user: IUser) {
    super(user, "welcome", "Welcome Email");
  }
  public override async SendEmail(next: NextFunction) {
    new WelcomeEmail(this.user, env.CLIENT_ORIGIN).sendEmail(
      "Welcome to Data Avengers LMS",
      this.template,
      next,
    );
  }
}

export class SendAdminInviteEmail extends GenerateUrlAndSendEmail {
  private tempPassword: string;

  constructor(user: IUser, tempPassword: string) {
    super(user, "adminInvite", "Admin Invite Email");
    this.tempPassword = tempPassword;
  }

  public override async SendEmail(next: NextFunction): Promise<void> {
    await new AdminInviteEmail(
      this.user,
      this.tempPassword,
      `${env.CLIENT_ADMIN_PANEL_ORIGIN}/auth`,
    ).sendEmail(
      "You've been invited to Data Avengers Admin Panel",
      this.template,
      next,
    );
  }
}

export class SendInvoiceEmail extends GenerateUrlAndSendEmail {
  private invoiceUrl: string;
  private invoiceData: Record<string, any>;

  constructor(
    user: IUser,
    invoiceUrl: string,
    invoiceData?: Record<string, any>,
  ) {
    super(user, "invoice", "Invoice Email");
    this.invoiceUrl = invoiceUrl;
    this.invoiceData = invoiceData || {};
  }

  public override async SendEmail(next: NextFunction): Promise<void> {
    await new InvoiceEmail(this.user, {
      invoiceUrl: this.invoiceUrl,
      ...this.invoiceData,
    }).sendEmail("Invoice", this.template, next);
  }
}
