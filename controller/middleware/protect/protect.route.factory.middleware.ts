import type { GqlGlobalContext } from "@gql/engine/engine.js";
import type {
  API_PROTOCOL_CONTEXT_TYPE,
  AuthenticatedUserRequestWithVerifiedEmail,
} from "@utils/helper/auth.types.helper.js";

import { type RoleLevel } from "@lib/prisma/index.js";
import { env } from "@lib/env/environment.js";
import { logger } from "@logger/index.js";
import type { NextFunction, Request, Response } from "express";
import { decode } from "next-auth/jwt";
import { type BaseRequestHandler, catchAsync } from "zodex-axon/core";
import { BadRequest, UnauthorizedAccess } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSessionToken(req: Request): string | undefined {
  // NextAuth v4 cookie names
  return (
    req.cookies["next-auth.session-token"] ||
    req.cookies["__Secure-next-auth.session-token"]
  );
}

async function decodeAndFindUser(sessionToken: string) {
  const decoded = await decode({ token: sessionToken, secret: env.JWT_SECRET });

  const userId = decoded?.id as string;
  const email = decoded?.email as string;

  if (!decoded || !userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId, email },
    select: {
      id: true,
      email: true,
      phone: true,
      role: { select: { level: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role?.level ?? null,
  };
}

// ─── protect factory ──────────────────────────────────────────────────────────

function createRestMiddleware() {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const sessionToken = extractSessionToken(req);

    if (!sessionToken) {
      logger.warn("REST auth: no session token", { ip: req.ip, path: req.path });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Authentication required",
        }),
      );
    }

    const user = await decodeAndFindUser(sessionToken);

    if (!user) {
      logger.warn("REST auth: invalid session or user not found", { ip: req.ip, path: req.path });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid session or user not found",
        }),
      );
    }

    logger.debug("REST auth: user authenticated", { userId: user.id, role: user.role, path: req.path });

    (req as AuthenticatedUserRequestWithVerifiedEmail).user = {
      id: user.id,
      email: user.email,
      role: user.role!,
    };
    next();
  });
}

function createGraphQLContext(): ({
  req,
}: {
  req: Request;
}) => Promise<GqlGlobalContext> {
  return async ({ req }: { req: Request }): Promise<GqlGlobalContext> => {
    const sessionToken = extractSessionToken(req);
    if (!sessionToken) return { user: null, req };

    try {
      const user = await decodeAndFindUser(sessionToken);
      if (!user) return { user: null, req };

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role!,
        },
        req,
      };
    } catch {
      return { user: null, req };
    }
  };
}

function protect(contextType: "REST"): BaseRequestHandler;
function protect(
  contextType: "GraphQL",
): ({ req }: { req: Request }) => Promise<GqlGlobalContext>;
function protect(contextType: API_PROTOCOL_CONTEXT_TYPE) {
  if (contextType === "REST") return createRestMiddleware();
  return createGraphQLContext();
}

// ─── roleChecker factory ──────────────────────────────────────────────────────

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

function createGraphQLRoleChecker(...requiredRoles: RoleLevel[]) {
  return (ctx: GqlGlobalContext) => {
    const userRole = ctx.user?.role;

    if (!userRole || !requiredRoles.includes(userRole))
      throw new Error("Insufficient permissions");
  };
}

function roleChecker(
  contextType: "REST",
  ...roles: RoleLevel[]
): BaseRequestHandler;
function roleChecker(
  contextType: "GraphQL",
  ...roles: RoleLevel[]
): (ctx: GqlGlobalContext) => void;
function roleChecker(
  contextType: API_PROTOCOL_CONTEXT_TYPE,
  ...roles: RoleLevel[]
) {
  if (contextType === "REST") return createRestRoleChecker(...roles);
  return createGraphQLRoleChecker(...roles);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const restProtectMiddleware = protect("REST");
export const graphQLContextMiddleware = protect("GraphQL");
export { roleChecker };
