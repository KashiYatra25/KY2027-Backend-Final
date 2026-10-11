import jwt, { type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "@lib/env/environment.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type {
  AccessTokenPayload,
  AdminTokenPair,
  DecodedAccessToken,
  DecodedRefreshToken,
} from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse expiry string to seconds (e.g., "2h" -> 7200)
 */
function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return 7200; // Default 2 hours
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 7200;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN GENERATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate both access and refresh tokens for admin
 */
export function generateAdminTokens(payload: AccessTokenPayload): AdminTokenPair {
  const jti = CryptoService.generateRandomToken(16);

  const accessTokenOptions: SignOptions = {
    expiresIn: env.ADMIN_JWT_ACCESS_EXPIRY as StringValue,
    jwtid: `access_${jti}`,
    issuer: "kashiyatra-admin",
    subject: payload.adminId,
  };

  const refreshTokenOptions: SignOptions = {
    expiresIn: env.ADMIN_JWT_REFRESH_EXPIRY as StringValue,
    jwtid: `refresh_${jti}`,
    issuer: "kashiyatra-admin",
    subject: payload.adminId,
  };

  const accessToken = jwt.sign(
    payload,
    env.ADMIN_JWT_ACCESS_SECRET,
    accessTokenOptions,
  );

  const refreshToken = jwt.sign(
    payload,
    env.ADMIN_JWT_REFRESH_SECRET,
    refreshTokenOptions,
  );

  const now = Math.floor(Date.now() / 1000);
  const accessTokenExpiry = now + parseExpiryToSeconds(env.ADMIN_JWT_ACCESS_EXPIRY);
  const refreshTokenExpiry = now + parseExpiryToSeconds(env.ADMIN_JWT_REFRESH_EXPIRY);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiry,
    refreshTokenExpiry,
  };
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN VERIFICATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Verify access token - returns decoded payload or null
 */
export function verifyAccessToken(token: string): DecodedAccessToken | null {
  try {
    const decoded = jwt.verify(token, env.ADMIN_JWT_ACCESS_SECRET, {
      issuer: "kashiyatra-admin",
    }) as DecodedAccessToken;

    // Verify it's an access token (jti starts with "access_")
    if (!decoded.jti?.startsWith("access_")) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token - returns decoded payload or null
 */
export function verifyRefreshToken(token: string): DecodedRefreshToken | null {
  try {
    const decoded = jwt.verify(token, env.ADMIN_JWT_REFRESH_SECRET, {
      issuer: "kashiyatra-admin",
    }) as DecodedRefreshToken;

    // Verify it's a refresh token (jti starts with "refresh_")
    if (!decoded.jti?.startsWith("refresh_")) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN DECODING (without verification)
// ═══════════════════════════════════════════════════════════════════

/**
 * Decode token without verification (for logging/debugging)
 */
export function decodeAdminToken(token: string): DecodedAccessToken | null {
  try {
    return jwt.decode(token) as DecodedAccessToken;
  } catch {
    return null;
  }
}

/**
 * Extract token ID (jti) from token
 */
export function getAdminTokenId(token: string): string | null {
  const decoded = decodeAdminToken(token);
  return decoded?.jti ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// EXPIRY HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get refresh token expiry time in milliseconds (for cookie maxAge)
 */
export function getRefreshTokenMaxAge(): number {
  return parseExpiryToSeconds(env.ADMIN_JWT_REFRESH_EXPIRY) * 1000;
}

/**
 * Get access token expiry time in seconds
 */
export function getAccessTokenExpirySeconds(): number {
  return parseExpiryToSeconds(env.ADMIN_JWT_ACCESS_EXPIRY);
}
