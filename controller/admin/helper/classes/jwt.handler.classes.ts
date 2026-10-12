import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "@lib/env/environment.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  DecodedAccessToken,
  DecodedRefreshToken,
  AdminTokenPair,
} from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT HANDLER CLASS
// ═══════════════════════════════════════════════════════════════════

export class AdminJwtHandler {
  // ─────────────────────────────────────────────────────────────────
  // Private instance variables (initialized from env)
  // ─────────────────────────────────────────────────────────────────
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly accessTokenExpirySeconds: number;
  private readonly refreshTokenExpirySeconds: number;
  private readonly issuer = "kashiyatra-admin";

  constructor() {
    this.accessTokenSecret = env.ADMIN_JWT_ACCESS_SECRET;
    this.refreshTokenSecret = env.ADMIN_JWT_REFRESH_SECRET;
    this.accessTokenExpiry = env.ADMIN_JWT_ACCESS_EXPIRY;
    this.refreshTokenExpiry = env.ADMIN_JWT_REFRESH_EXPIRY;
    this.accessTokenExpirySeconds = this.parseExpiryToSeconds(this.accessTokenExpiry);
    this.refreshTokenExpirySeconds = this.parseExpiryToSeconds(this.refreshTokenExpiry);
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Parse expiry string to seconds (e.g., "2h" -> 7200, "7d" -> 604800)
   */
  private parseExpiryToSeconds(expiry: string): number {
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

  /**
   * Generate a unique token ID (jti) for tracking/blacklisting
   */
  private generateTokenId(): string {
    return CryptoService.generateRandomToken(16);
  }

  // ─────────────────────────────────────────────────────────────────
  // Token Creation Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create an access token
   * Payload: adminId, email, role
   */
  createAccessToken(payload: AccessTokenPayload, jti?: string): string {
    const tokenId = jti ?? this.generateTokenId();

    const options: SignOptions = {
      expiresIn: this.accessTokenExpiry as StringValue,
      jwtid: `access_${tokenId}`,
      issuer: this.issuer,
      subject: payload.adminId,
    };

    return jwt.sign(payload, this.accessTokenSecret, options);
  }

  /**
   * Create a refresh token
   * Payload: adminId, email (no role - minimal data)
   */
  createRefreshToken(payload: RefreshTokenPayload, jti?: string): string {
    const tokenId = jti ?? this.generateTokenId();

    const options: SignOptions = {
      expiresIn: this.refreshTokenExpiry as StringValue,
      jwtid: `refresh_${tokenId}`,
      issuer: this.issuer,
      subject: payload.adminId,
    };

    return jwt.sign(payload, this.refreshTokenSecret, options);
  }

  /**
   * Create both access and refresh tokens
   * Uses same jti base for correlation
   */
  createTokenPair(payload: AccessTokenPayload): AdminTokenPair {
    const jti = this.generateTokenId();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = this.createAccessToken(payload, jti);
    const refreshToken = this.createRefreshToken(
      { userId: payload.userId, adminId: payload.adminId, email: payload.email, role: payload.role },
      jti
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiry: now + this.accessTokenExpirySeconds,
      refreshTokenExpiry: now + this.refreshTokenExpirySeconds,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Token Validation Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate and decode access token
   * Returns null if invalid/expired
   */
  validateAccessToken(token: string): DecodedAccessToken | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
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
   * Validate and decode refresh token
   * Returns null if invalid/expired
   */
  validateRefreshToken(token: string): DecodedRefreshToken | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
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

  // ─────────────────────────────────────────────────────────────────
  // Token Decode Methods (without validation)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Decode access token without verification
   * Useful for checking expiry before refresh
   */
  decodeAccessToken(token: string): DecodedAccessToken | null {
    try {
      const decoded = jwt.decode(token) as DecodedAccessToken | null;
      if (!decoded?.jti?.startsWith("access_")) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Decode refresh token without verification
   * Useful for extracting adminId for blacklist lookup
   */
  decodeRefreshToken(token: string): DecodedRefreshToken | null {
    try {
      const decoded = jwt.decode(token) as DecodedRefreshToken | null;
      if (!decoded?.jti?.startsWith("refresh_")) {
        return null;
      }
      return decoded;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Token Utility Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Extract the base token ID (without prefix) for correlation
   * access_abc123 -> abc123
   * refresh_abc123 -> abc123
   */
  extractTokenId(token: string): string | null {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (!decoded?.jti) return null;

    // Remove prefix (access_ or refresh_)
    return decoded.jti.replace(/^(access_|refresh_)/, "");
  }

  /**
   * Get the full jti from a token
   */
  getTokenJti(token: string): string | null {
    const decoded = jwt.decode(token) as JwtPayload | null;
    return decoded?.jti ?? null;
  }

  /**
   * Check if access token is expired (without full validation)
   */
  isAccessTokenExpired(token: string): boolean {
    const decoded = this.decodeAccessToken(token);
    if (!decoded?.exp) return true;
    return decoded.exp < Math.floor(Date.now() / 1000);
  }

  /**
   * Check if refresh token is expired (without full validation)
   */
  isRefreshTokenExpired(token: string): boolean {
    const decoded = this.decodeRefreshToken(token);
    if (!decoded?.exp) return true;
    return decoded.exp < Math.floor(Date.now() / 1000);
  }

  /**
   * Get access token expiry in seconds
   */
  getAccessTokenExpirySeconds(): number {
    return this.accessTokenExpirySeconds;
  }

  /**
   * Get refresh token expiry in seconds
   */
  getRefreshTokenExpirySeconds(): number {
    return this.refreshTokenExpirySeconds;
  }

  /**
   * Get refresh token expiry in milliseconds (for cookie maxAge)
   */
  getRefreshTokenMaxAgeMs(): number {
    return this.refreshTokenExpirySeconds * 1000;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════

export const adminJwtHandler = new AdminJwtHandler();
