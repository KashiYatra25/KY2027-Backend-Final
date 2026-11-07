import { env } from "@lib/env/environment.js";
import type { EmailBrand, IUser } from "@email/types/email.types.js";
import path from "path";
import { fileURLToPath } from "url";
import { create } from "express-handlebars";
import fs from "fs/promises";
import { logger } from "@logger/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// BREVO API TYPES
// ═══════════════════════════════════════════════════════════════════

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
}

interface BrevoSuccessResponse {
  messageId: string;
}

interface BrevoErrorResponse {
  message: string;
  code: string;
}

// ═══════════════════════════════════════════════════════════════════
// HANDLEBARS ENGINE (for rendering templates to HTML)
// ═══════════════════════════════════════════════════════════════════

const hbsEngine = create({
  extname: ".handlebars",
  defaultLayout: false,
  partialsDir: path.join(__dirname, "./views/partials"),
});

// ═══════════════════════════════════════════════════════════════════
// EMAIL BASE CLASS
// ═══════════════════════════════════════════════════════════════════

export abstract class Email {
  public to: EmailBrand;

  public from: EmailBrand;

  public firstName: string;

  protected constructor(user: IUser) {
    this.to = user.email as EmailBrand;
    this.from = env.EMAIL_FROM as EmailBrand;
    this.firstName = user.name.split(" ")[0] as string;
  }

  abstract sendEmail(subject: string, template: string): Promise<void>;

  /**
   * Render a Handlebars template to HTML string
   */
  private async renderTemplate(
    template: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const templatePath = path.join(__dirname, "./views", `${template}.handlebars`);
    
    // Use express-handlebars renderView method
    const html = await hbsEngine.render(templatePath, context);
    return html;
  }

  /**
   * Send email via Brevo HTTP API
   * 
   * Uses the transactional email API endpoint instead of SMTP.
   * This works on platforms like Render free tier that block port 587.
   */
  private async sendViaBrevoAPI(
    subject: string,
    htmlContent: string,
    recipientName?: string,
  ): Promise<void> {
    const payload: BrevoEmailPayload = {
      sender: {
        name: "Kashiyatra 2027",
        email: this.from,
      },
      to: [
        {
          email: this.to,
          name: recipientName || this.firstName,
        },
      ],
      subject,
      htmlContent,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as BrevoErrorResponse;
      logger.error("Brevo API error", {
        status: response.status,
        code: errorData.code,
        message: errorData.message,
        to: this.to,
        subject,
      });
      throw new Error(`Brevo API error: ${errorData.message} (${errorData.code})`);
    }

    const successData = (await response.json()) as BrevoSuccessResponse;
    logger.debug("Email sent via Brevo API", {
      messageId: successData.messageId,
      to: this.to,
      subject,
    });
  }

  /**
   * Send email using a Handlebars template
   * 
   * 1. Renders the template with the provided context
   * 2. Sends the HTML via Brevo HTTP API
   */
  protected async sendWithTemplate(
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    // Render template to HTML
    const htmlContent = await this.renderTemplate(template, context);
    
    // Send via Brevo API
    await this.sendViaBrevoAPI(subject, htmlContent);
  }
}
