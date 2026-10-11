import { z } from "zod";
import { RequestGuardMiddleware as GqlRequestGuardMiddleware } from "gql-axon";
import { BadRequestError } from "gql-axon/errors";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import {
  verifyAccessToken,
  decodeAdminToken,
  type DecodedAccessToken,
} from "@controller/admin/helper/functions/index.js";
import { redisService } from "@services/redis/index.js";
import { getAdminRefreshTokenKey } from "@services/redis/keys/redis.keys.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN GRAPHQL MIDDLEWARE
//
// Separate from user REST/GQL protection middleware.
// Admin GQL queries require:
// 1. Valid NextAuth session (handled by expressMiddleware context)
// 2. Valid Admin JWT from Authorization header
// 3. Admin role validation
//
// The admin JWT is passed via the Authorization header in the request.
// This is separate from the user session to provide step-up auth.
// ═══════════════════════════════════════════════════════════════════

// Schema to validate the user context
const adminContextSchema = z.object({
  user: z
    .object({
      id: z.string().min(1, "User ID is required"),
      email: z.string().email("Invalid email address"),
      role: z.enum(["MASTER_ADMIN", "MANAGER", "OPERATOR", "USER"]),
    })
    .nullable(),
});

export type AdminValidatedContextType = z.infer<typeof adminContextSchema>;

// Extended context with admin token
export interface AdminGqlContext extends GqlGlobalContext {
  adminToken?: DecodedAccessToken;
  validatedContext?: AdminValidatedContextType;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST GUARD (validates context structure)
// ═══════════════════════════════════════════════════════════════════

export const adminContextGuard = GqlRequestGuardMiddleware<
  { context: AdminValidatedContextType },
  GqlGlobalContext
>({
  context: adminContextSchema,
});

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

// ═══════════════════════════════════════════════════════════════════
// ROLE GUARDS
// ═══════════════════════════════════════════════════════════════════

/**
 * Guard: Requires MASTER_ADMIN role
 */
export const isMasterAdminGuard = async (
  _parent: unknown,
  _args: unknown,
  context: AdminGqlContext,
  _info: unknown
) => {
  if (!context.adminToken) {
    throw new BadRequestError("Admin authentication required.");
  }

  if (context.adminToken.role !== "MASTER_ADMIN") {
    throw new BadRequestError("Master admin access required for this operation.");
  }
};

/**
 * Guard: Requires MASTER_ADMIN or MANAGER role
 */
export const isManagerOrAboveGuard = async (
  _parent: unknown,
  _args: unknown,
  context: AdminGqlContext,
  _info: unknown
) => {
  if (!context.adminToken) {
    throw new BadRequestError("Admin authentication required.");
  }

  const role = context.adminToken.role;
  if (role !== "MASTER_ADMIN" && role !== "MANAGER") {
    throw new BadRequestError("Manager or higher access required for this operation.");
  }
};

/**
 * Guard: Requires any admin role (MASTER_ADMIN, MANAGER, or OPERATOR)
 */
export const isAdminGuard = async (
  _parent: unknown,
  _args: unknown,
  context: AdminGqlContext,
  _info: unknown
) => {
  if (!context.adminToken) {
    throw new BadRequestError("Admin authentication required.");
  }

  const role = context.adminToken.role;
  const adminRoles = ["MASTER_ADMIN", "MANAGER", "OPERATOR"];

  if (!adminRoles.includes(role)) {
    throw new BadRequestError("Admin access required for this operation.");
  }
};
