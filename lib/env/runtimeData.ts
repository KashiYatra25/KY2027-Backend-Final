import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Create validated environment configuration
 */
function createRuntimeEnvironment(
  runtimeEnv: Record<string, any> = process.env,
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
      BREVO_SMTP_USER: z
        .string()
        .min(1, "Brevo SMTP user is required"),
      BREVO_API_KEY: z
        .string()
        .min(10, "Brevo API Key is required"),

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
      ADMIN_JWT_ACCESS_EXPIRY: z
        .string()
        .default("2h"),
      ADMIN_JWT_REFRESH_EXPIRY: z
        .string()
        .default("7d"),

      // gRPC Payment Service Configuration
      PAYMENT_GRPC_HOST: z
        .string()
        .min(1, "Payment gRPC host is required")
        .default("localhost"),
      PAYMENT_GRPC_PORT: z
        .string()
        .regex(/^\d+$/, "Payment gRPC port must be a number")
        .default("50051"),
      PAYMENT_SERVICE_TOKEN: z
        .string()
        .min(32, "Payment service token must be at least 32 characters"),
      // Optional path to the payment service's TLS cert (used as the trusted
      // root for the gRPC client). Empty/unset → insecure channel (dev only).
      PAYMENT_GRPC_CA_CERT: z.string().optional().default(""),
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
