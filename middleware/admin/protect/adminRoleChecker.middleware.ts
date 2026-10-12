import type { NextFunction, Response } from "express";
import type { RoleLevel } from "@lib/prisma/index.js";
import type { AdminRequestWithVerifiedCreds } from "@root/middleware/admin/helper/types/jwt.types.js";
import { type BaseRequestHandler, catchAsync } from "zodex-axon/core";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { logger } from "@root/lib/logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN ROLE CHECKER MIDDLEWARE
//
// Checks req.admin.role (set by adminRoutesRESTProtectMiddleware)
// This is SEPARATE from roleCheckerMiddleware which checks req.user.role
// ═══════════════════════════════════════════════════════════════════

/**
 * Admin role checker factory - creates middleware for admin routes
 *
 * @param requiredRoles - Roles that are allowed to access the route
 * @returns Middleware that checks if admin has one of the required roles
 *
 * @example
 * router.get(
 *   "/admin-only",
 *   adminRoleCheckerMiddleware("MASTER_ADMIN", "MANAGER"),
 *   handler
 * );
 */
export function adminRoleCheckerMiddleware(
  ...requiredRoles: Exclude<RoleLevel, "USER">[]
): BaseRequestHandler {
  return catchAsync(
    async (
      req: AdminRequestWithVerifiedCreds,
      res: Response,
      next: NextFunction,
    ) => {
      const adminRole = req.admin?.role;

      if (!adminRole || !requiredRoles.includes(adminRole)) {
        logger.warn("Admin role check failed", {
          adminId: req.admin?.adminId,
          adminRole,
          requiredRoles,
          path: req.path,
        });
        return next(
          new ForbiddenErrorResponse().handleResponse(res, {
            info: "Insufficient permissions for this action",
            code: "INSUFFICIENT_ROLE",
          }),
        );
      }

      next();
    },
  );
}
