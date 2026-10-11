import { env } from "@lib/env/environment.js";

// Apollo Studio origin for GraphQL testing (development only)
const APOLLO_STUDIO_ORIGIN = "https://studio.apollographql.com";

// ═══════════════════════════════════════════════════════════════════
// SEC-010 FIX: Remove null origin fallback in production
// 
// Allowing !origin (null/undefined origin) permits requests from:
// - file:// protocol
// - Browser redirects
// - Sandboxed iframes
// - Some privacy extensions
// 
// This is acceptable in development but a security risk in production.
// ═══════════════════════════════════════════════════════════════════

const isProduction = process.env.NODE_ENV === "production";

// Allowed origins list
const allowedOrigins = [
  env.CLIENT_ORIGIN,
  env.CLIENT_ADMIN_PANEL_ORIGIN,
];

// In development, also allow Apollo Studio for GraphQL testing
if (!isProduction) {
  allowedOrigins.push(APOLLO_STUDIO_ORIGIN);
}

export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, status: boolean) => void,
  ) => {
    // SEC-010: In production, REQUIRE a valid origin
    // In development, allow no origin for tools like Postman, curl, etc.
    if (!origin) {
      if (isProduction) {
        // Production: Block requests with no origin
        callback(new Error("Origin required"), false);
      } else {
        // Development: Allow requests with no origin (Postman, curl, etc.)
        callback(null, true);
      }
      return;
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Access-Token-Expiry"],
  exposedHeaders: ["Authorization", "X-Access-Token-Expiry"],
  credentials: true,
  optionsSuccessStatus: 204,
};
