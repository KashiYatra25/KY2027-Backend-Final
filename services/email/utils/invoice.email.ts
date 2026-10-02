import { type NextFunction } from 'express';
import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class InvoiceEmail extends Email {
  private invoiceData: Record<string, any>;

  constructor(user: IUser, invoiceData: Record<string, any>) {
    super(user);
    this.invoiceData = invoiceData;
  }

  override async sendEmail(
    subject: string,
    template: string,
    next?: NextFunction
  ): Promise<void> {
    await this.sendWithTemplate(
      subject,
      template,
      {
        userName: this.firstName,
        ...this.invoiceData,
      },
      next
    );
  }
}