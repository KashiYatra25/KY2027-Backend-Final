import type { RoleLevel } from "@lib/prisma/index.js";

/**
 * Decoded user data from session token
 */
export interface DecodedUser {
  id: string;
  email: string;
  phone: string | null;
  role: RoleLevel | null;
}

/**
 * Authenticated user data attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: RoleLevel;
}
