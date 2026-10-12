import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class ForgotPasswordEmail extends Email {
  private resetUrl: string;

  constructor(user: IUser, resetUrl: string) {
    super(user);
    this.resetUrl = resetUrl;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      email: this.to,
      resetUrl: this.resetUrl,
    });
  }
}
