import { type NextFunction } from 'express';
import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class WelcomeEmail extends Email {
  private appUrl: string;

  constructor(user: IUser, appUrl: string) {
    super(user);
    this.appUrl = appUrl;
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
        appUrl: this.appUrl,
        userName: this.firstName,
      },
      next
    );
  }
}
