import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import { catchAsync } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import { logger } from "@root/lib/logger/logger";
import { decodeAndFindUser, extractSessionToken } from "./helper/functions/session.helper";

/**
 * REST API authentication middleware
 * Validates NextAuth session token and attaches user to request
 */
export const userRoutesRESTProtectMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const sessionToken = extractSessionToken(req);

    if (!sessionToken) {
      logger.warn("REST auth: no session token", {
        ip: req.ip,
        path: req.path,
      });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Authentication required",
        })
      );
    }

    const user = await decodeAndFindUser(sessionToken);

    if (!user) {
      logger.warn("REST auth: invalid session or user not found", {
        ip: req.ip,
        path: req.path,
      });
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid session or user not found",
        })
      );
    }

    logger.debug("REST auth: user authenticated", {
      userId: user.id,
      role: user.role,
      path: req.path,
    });

    (req as AuthenticatedUserRequestWithVerifiedEmail).user = {
      id: user.id,
      email: user.email,
      role: user.role!,
    };

    next();
  }
);
