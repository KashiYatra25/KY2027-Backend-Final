/**
 * SSM Upload Configuration for Backend
 *
 * Define which env vars are secure, which to skip, and name overrides
 */

/**
 * Env vars that should be stored as SecureString (sensitive data)
 */
export const SECURE_STRING_VARS = [
  "REDIS_PASSWORD",
  "DATABASE_URL",
  "Mongodb_Database_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
  "RABBITMQ_URL",
] as const;

/**
 * Env vars to skip (not needed in SSM or managed separately)
 */
export const SKIP_VARS = [
  // Add any vars you want to skip
] as const;

/**
 * Map of env var names to their SSM parameter names (optional overrides)
 * If not specified, the env var name will be used as-is
 */
export const NAME_OVERRIDES: Record<string, string> = {
  // Example: 'DATABASE_URL': 'db-url'
};

/**
 * Default CLI configuration
 */
export const DEFAULT_CONFIG = {
  env: "development",
  region: "ap-south-1",
  prefix: "/kashiyatra/backend",
} as const;
