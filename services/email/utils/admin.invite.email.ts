import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export class AdminInviteEmail extends Email {
  private tempPassword: string;
  private loginUrl: string;

  constructor(user: IUser, tempPassword: string, loginUrl: string) {
    super(user);
    this.tempPassword = tempPassword;
    this.loginUrl = loginUrl;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      email: this.to,
      tempPassword: this.tempPassword,
      loginUrl: this.loginUrl,
    });
  }
}
