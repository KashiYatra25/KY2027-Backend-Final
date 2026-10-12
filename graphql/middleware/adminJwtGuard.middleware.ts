import { BadRequestError } from "gql-axon/errors";
import {
  verifyAccessToken,
  decodeAdminToken,
} from "@controller/admin/helper/functions/index.js";
import { redisService } from "@services/redis/index.js";
import { getAdminRefreshTokenKey } from "@services/redis/keys/redis.keys.js";
import { type AdminGqlContext } from "@gql/helper/types/index.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN JWT GUARD
//
// Verifies the admin JWT from Authorization header.
// This provides step-up authentication beyond the NextAuth session.
// ═══════════════════════════════════════════════════════════════════

export const adminJwtGuard = async (
  _parent: unknown,
  _args: unknown,
  context: AdminGqlContext,
  _info: unknown
) => {
  const req = context.req;

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new BadRequestError(
      "Admin authentication required. Please login to the admin panel."
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Decode without verification first to check expiry
  const decodedWithoutVerify = decodeAdminToken(token);

  if (!decodedWithoutVerify) {
    throw new BadRequestError("Invalid admin token.");
  }

  // Verify the access token
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedWithoutVerify.exp && decodedWithoutVerify.exp < now) {
      throw new BadRequestError("Admin token expired. Please refresh.");
    }
    throw new BadRequestError("Invalid admin token. Please login again.");
  }

  // Check if the corresponding refresh token JTI is still valid in Redis
  const refreshJti = decoded.jti?.replace("access_", "refresh_");
  if (refreshJti) {
    const storedJti = await redisService.redisConnection!.get(
      getAdminRefreshTokenKey(decoded.userId)
    );

    if (!storedJti || storedJti !== refreshJti) {
      throw new BadRequestError(
        "Admin session has been invalidated. Please login again."
      );
    }
  }

  // Verify admin user matches session user
  if (context.user && decoded.userId !== context.user.id) {
    throw new BadRequestError(
      "Admin token doesn't match current session. Please login again."
    );
  }

  // Attach admin token to context for downstream use
  context.adminToken = decoded;
};
