import { z } from "zod";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import { type DecodedAccessToken } from "@controller/admin/helper/functions/index.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema to validate the admin user context
 */
export const adminContextSchema = z.object({
  user: z
    .object({
      id: z.string().min(1, "User ID is required"),
      email: z.string().email("Invalid email address"),
      role: z.enum(["MASTER_ADMIN", "MANAGER", "OPERATOR", "USER"]),
    })
    .nullable(),
});

export type AdminValidatedContextType = z.infer<typeof adminContextSchema>;

/**
 * Extended context with admin token for downstream use
 */
export interface AdminGqlContext extends GqlGlobalContext {
  adminToken?: DecodedAccessToken;
  validatedContext?: AdminValidatedContextType;
}

// ═══════════════════════════════════════════════════════════════════
// USER CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Schema to validate the user object within the GraphQL context
 */
export const userContextSchema = z.object({
  user: z
    .object({
      id: z.string().min(1, "User ID is required"),
      email: z.string().email("Invalid email address"),
    })
    .nullable(),
});

export type UserValidatedContextType = z.infer<typeof userContextSchema>;
