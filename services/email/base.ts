import { env } from "@lib/env/environment.js";
import nodemailer from "nodemailer";
import type { EmailBrand, IUser } from "@email/types/email.types.js";
import path from "path";
import { fileURLToPath } from "url";
import type hbs from "nodemailer-express-handlebars";
import { create } from "express-handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export abstract class Email {
  public to: EmailBrand;

  public from: EmailBrand;

  public firstName: string;

  protected static handleBarsOption: hbs.NodemailerExpressHandlebarsOptions = {
    viewEngine: create({
      extname: ".handlebars",
      defaultLayout: false,
      partialsDir: path.join(__dirname, "./views/partials"),
    }) as unknown as hbs.NodemailerExpressHandlebarsOptions["viewEngine"],
    extName: ".handlebars",
    viewPath: path.join(__dirname, "./views"),
  };

  protected constructor(user: IUser) {
    this.to = user.email as EmailBrand;
    this.from = env.EMAIL_FROM as EmailBrand;
    this.firstName = user.name.split(" ")[0] as string;
  }

  protected static transporter() {
    return nodemailer.createTransport({
      host: env.BREVO_SMTP_HOST,
      port: env.BREVO_SMTP_PORT,
      secure: false,
      auth: {
        user: env.BREVO_SMTP_USER,
        pass: env.BREVO_API_KEY,
      },
    });
  }

  abstract sendEmail(subject: string, template: string): Promise<void>;

  protected async sendWithTemplate(
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    const transporter = Email.transporter();
    const hbs = (await import("nodemailer-express-handlebars")).default;
    transporter.use("compile", hbs(Email.handleBarsOption));

    const mailOptions = {
      to: this.to,
      from: this.from,
      subject,
      template,
      context,
    };

    await transporter.sendMail(mailOptions);
  }
}
