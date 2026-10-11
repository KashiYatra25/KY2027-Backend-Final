import type { JwtPayload } from "jsonwebtoken";
import type { RoleLevel } from "@lib/prisma/index.js";
import type { Request } from "express";

// ═══════════════════════════════════════════════════════════════════
// TOKEN PAYLOAD TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Payload for generating admin tokens
 */
export interface AccessTokenPayload {
  adminId: string;
  email: string;
  role: RoleLevel;
}

/**
 * Refresh token payload (same as access for simplicity)
 */
export type RefreshTokenPayload = AccessTokenPayload;

// ═══════════════════════════════════════════════════════════════════
// DECODED TOKEN TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Decoded access token with JWT claims
 */
export interface DecodedAccessToken extends AccessTokenPayload, JwtPayload {
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Decoded refresh token with JWT claims
 */
export interface DecodedRefreshToken extends AccessTokenPayload, JwtPayload {
  iat: number;
  exp: number;
  jti: string;
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN PAIR TYPE
// ═══════════════════════════════════════════════════════════════════

/**
 * Token pair returned after generation
 */
export interface AdminTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST WITH ADMIN DATA
// ═══════════════════════════════════════════════════════════════════

/**
 * Request extended with verified admin JWT data
 */
export interface AdminRequestWithVerifiedCreds extends Request {
  admin: {
    id: string;
    email: string;
    role: Exclude<RoleLevel, "USER">;
  };
}

