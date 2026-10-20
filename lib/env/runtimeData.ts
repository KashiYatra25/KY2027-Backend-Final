import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Create validated environment configuration
 */
function createRuntimeEnvironment(
  runtimeEnv: Record<string, string | undefined> = process.env,
) {
  return createEnv({
    server: {
      HTTP_SERVER_PORT: z
        .string()
        .min(4, "Port must be at least 4 characters long")
        .max(5, "Port must be at most 5 characters long")
        .regex(/^\d+$/, "Port must be a number"),
      REDIS_HOST: z
        .string()
        .min(1, "Redis host is required")
        .default("localhost"),
      REDIS_PORT: z
        .string()
        .regex(/^\d+$/, "Port must be a number")
        .transform(Number)
        .default(6379),
      REDIS_PASSWORD: z.string().min(5, "Redis password is required"),
      DATABASE_URL: z.string().min(10, "Postgres Database URL is required"),
      Mongodb_Database_URL: z
        .string()
        .min(10, "MongoDB Database URL is required"),
      BASE_API_ENDPOINT: z.string().min(1, "Base API Endpoint is required"),
      JWT_SECRET: z.string().min(10, "JWT Secret is required"),
      ENCRYPTION_KEY: z.string().min(10, "Encryption Key is required"),
      CSRF_TOKEN_EXPIRATION_TIME: z
        .string()
        .regex(/^\d+$/, "CSRF Token Expiration Time must be a number")
        .transform(Number),
      CSRF_TOKEN_HEADER_NAME: z
        .string()
        .min(5, "CSRF Token Header Name is required"),
      SUPER_ADMIN_EMAIL: z
        .email("Invalid email address")
        .min(5, "Super Admin Email is required"),
      OTP_RATE_LIMIT_MAX: z
        .string()
        .regex(/^\d+$/, "OTP Rate Limit Max must be a number")
        .transform(Number)
        .default(3),
      OTP_RATE_LIMIT_WINDOW_SECONDS: z
        .string()
        .regex(/^\d+$/, "OTP Rate Limit Window must be a number")
        .transform(Number)
        .default(600),
      OTP_THROTTLE_COOLDOWN_SECONDS: z
        .string()
        .regex(/^\d+$/, "OTP Throttle Cooldown must be a number")
        .transform(Number)
        .default(60),

      // AWS Configuration
      AWS_REGION: z
        .string()
        .min(5, "AWS Region is required")
        .default("ap-south-1"),

      // Email Configuration (Brevo SMTP)
      EMAIL_FROM: z.email("Invalid email address").min(5, "Email is required"),
      BREVO_SMTP_HOST: z
        .string()
        .min(1, "Brevo SMTP host is required")
        .default("smtp-relay.brevo.com"),
      BREVO_SMTP_PORT: z
        .string()
        .regex(/^\d+$/, "Brevo SMTP port must be a number")
        .default("587")
        .transform(Number),
      BREVO_SMTP_USER: z.string().min(1, "Brevo SMTP user is required"),
      BREVO_API_KEY: z.string().min(10, "Brevo API Key is required"),

      // S3 Configuration
      S3_BUCKET: z.string().min(3, "S3 Bucket is required"),

      // Google OAuth Configuration (for server-side token verification)
      GOOGLE_CLIENT_ID: z
        .string()
        .min(20, "Google Client ID is required for OAuth verification"),

      // Admin JWT Configuration
      ADMIN_JWT_ACCESS_SECRET: z
        .string()
        .min(32, "Admin JWT Access Secret must be at least 32 characters"),
      ADMIN_JWT_REFRESH_SECRET: z
        .string()
        .min(32, "Admin JWT Refresh Secret must be at least 32 characters"),
      ADMIN_JWT_ACCESS_EXPIRY: z.string().default("2h"),
      ADMIN_JWT_REFRESH_EXPIRY: z.string().default("7d"),

      // KonfHub Webhook Configuration (optional - for signature verification)
      // If set, webhook requests will be verified using this secret
      KONFHUB_WEBHOOK_SECRET: z.string().optional().default(""),

      // KonfHub custom-field key that carries our Kashiyatra ID in the
      // webhook payload (attendee details). Must match the field name
      // configured on the KonfHub event form (e.g. "KY_ID" or "KY-2027-ID").
      KONFHUB_KY_ID_FIELD: z.string().min(1).default("KY_ID"),

      // KonfHub ticket-name -> pass tier mapping (keyword-based, comma-separated).
      // Matching is case-insensitive substring match on ticket name.
      // Anything unmatched defaults to Yatri.
      KONFHUB_DARBAR_KEYWORDS: z.string().default("darbar,vip,platinum"),
      KONFHUB_SWARNIM_KEYWORDS: z.string().default("swarnim,gold"),

      // KonfHub Zonals ticket-name keyword mappings (comma-separated, case-insensitive).
      // Each college has SINGLE and MULTI keywords - ticket name is matched against these.
      // Same pattern as KONFHUB_DARBAR_KEYWORDS / KONFHUB_SWARNIM_KEYWORDS for main fest.

      // RGIPT Zonals
      KONFHUB_ZONALS_RGIPT_SINGLE_KEYWORDS: z.string().default("rgipt single"),
      KONFHUB_ZONALS_RGIPT_MULTI_KEYWORDS: z
        .string()
        .default("rgipt multi,rgipt all"),
      KONFHUB_TICKET_TIER_MAP: z.string(),

      // Add more colleges as needed:
      // KONFHUB_ZONALS_NITP_SINGLE_KEYWORDS: z.string().default("nit patna single,nitp single"),
      // KONFHUB_ZONALS_NITP_MULTI_KEYWORDS: z.string().default("nit patna multi,nitp multi"),

      // ═══════════════════════════════════════════════════════════════════
      // OBSERVABILITY - Loki / Grafana Cloud
      // ═══════════════════════════════════════════════════════════════════

      // Loki endpoint - local or Grafana Cloud
      // Local: http://localhost:3100
      // Grafana Cloud: https://logs-prod-xxx.grafana.net
      LOKI_HOST: z.string().url().default("http://localhost:3100"),

      // Grafana Cloud auth (optional - only needed for Grafana Cloud)
      // Get these from: Grafana Cloud → Your Stack → Loki → Details
      LOKI_USER: z.string().optional(),
      LOKI_API_KEY: z.string().optional(),
    },
    clientPrefix: "CLIENT",
    client: {
      CLIENT_ORIGIN: z.url("Invalid URL").default("http://localhost:3000"),
      CLIENT_ADMIN_PANEL_ORIGIN: z
        .url("Invalid URL")
        .default("http://localhost:3000"),
    },
    runtimeEnv,
  });
}

export { createRuntimeEnvironment };
