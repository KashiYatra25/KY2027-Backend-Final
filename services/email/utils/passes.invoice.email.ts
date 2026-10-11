import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class InvoiceEmail extends Email {
  private invoiceData: Record<string, unknown>;

  constructor(user: IUser, invoiceData: Record<string, unknown>) {
    super(user);
    this.invoiceData = invoiceData;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      ...this.invoiceData,
    });
  }
}