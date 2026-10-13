import type { NextFunction, Response } from "express";
import type { GqlGlobalContext } from "@gql/engine/engine.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { RoleLevel } from "@lib/prisma/index.js";
import { type BaseRequestHandler, catchAsync } from "zodex-axon/core";
import { UnauthorizedAccess } from "zodex-axon/errors";
import { logger } from "@root/lib/logger/logger";


/**
 * REST role checker factory
 */
function createRestRoleChecker(
  ...requiredRoles: RoleLevel[]
): BaseRequestHandler {
  return catchAsync(
    async (
      req: AuthenticatedUserRequestWithVerifiedEmail,
      res: Response,
      next: NextFunction,
    ) => {
      const userRole = req.user?.role;

      if (!userRole || !requiredRoles.includes(userRole)) {
        logger.warn("REST role check failed", {
          userId: req.user?.id,
          userRole,
          requiredRoles,
          path: req.path,
        });
        return next(
          new UnauthorizedAccess().handleResponse(res, {
            info: "Insufficient permissions",
          }),
        );
      }

      next();
    },
  );
}

/**
 * GraphQL role checker factory
 */
function createGraphQLRoleChecker(...requiredRoles: RoleLevel[]) {
  return (ctx: GqlGlobalContext) => {
    const userRole = ctx.user?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new Error("Insufficient permissions");
    }
  };
}

/**
 * Role checker factory - creates middleware for REST or GraphQL
 *
 * @example
 * // REST usage
 * router.get("/admin", roleCheckerMiddleware("REST", "MASTER_ADMIN", "MANAGER"), handler);
 *
 * // GraphQL usage
 * const checkAdmin = roleCheckerMiddleware("GraphQL", "MASTER_ADMIN");
 */
function roleCheckerMiddleware(
  contextType: "REST",
  ...roles: RoleLevel[]
): BaseRequestHandler;
function roleCheckerMiddleware(
  contextType: "GraphQL",
  ...roles: RoleLevel[]
): (ctx: GqlGlobalContext) => void;
function roleCheckerMiddleware(
  contextType: "REST" | "GraphQL",
  ...roles: RoleLevel[]
): BaseRequestHandler | ((ctx: GqlGlobalContext) => void) {
  if (contextType === "REST") {
    return createRestRoleChecker(...roles);
  }
  return createGraphQLRoleChecker(...roles);
}

export { roleCheckerMiddleware };
