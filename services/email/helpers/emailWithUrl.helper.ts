import { type IUser } from '@email/types/email.types.js';

export abstract class GenerateUrlAndSendEmail {
  protected user: IUser;

  protected template: string;

  protected subject: string;

  public constructor(
    user: IUser,
    template: string,
    subject: string,
  ) {
    this.subject = subject;
    this.template = template;
    this.user = user;
  }


  public abstract SendEmail(..._args: unknown[]): Promise<void>;
}