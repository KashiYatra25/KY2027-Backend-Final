import type { Request } from "express";
import type { RoleLevel } from "@lib/prisma/index.js";

/**
 * Request with verified admin JWT token
 */
export interface AdminRequestWithVerifiedCreds extends Request {
  admin: {
    userId: string;
    adminId: string;
    email: string;
    role: Exclude<RoleLevel, "USER">;
  };
}
