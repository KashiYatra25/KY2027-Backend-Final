import { getRefreshTokenMaxAge } from "@controller/admin/helper/functions/index.js";

// Admin refresh token cookie configuration
export const ADMIN_REFRESH_TOKEN_COOKIE_NAME = "admin_refresh_token";

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/admin",
  maxAge: getRefreshTokenMaxAge(),
};

export const ADMIN_COOKIE_PATH = "/api/v1/admin";
