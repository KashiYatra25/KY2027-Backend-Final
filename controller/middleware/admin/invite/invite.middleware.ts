import { checkForProfileCompletion } from "@controller/helper/checkWhetherProfileIsCompleted";
import type { AdminInviteSchemaType } from "@schemas/admin/admin.schema.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import type { AdminInviteRequestWithTargetUser } from "./types.js";

/**
 * Middleware to validate target user exists and has completed profile
 * Also validates that requester has permission to assign the target role:
 * - MASTER_ADMIN: Can assign MANAGER or OPERATOR
 * - MANAGER: Can only assign OPERATOR
 */
export const validateTargetUserForInvite = catchAsync(
  async (
    req: VerifiedRequest<
      { body: AdminInviteSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { targetEmail, role: targetRole } = req.validatedData;
    const requesterRole = req.user.role;

    // Check if requester has permission to assign this role
    if (requesterRole === "MANAGER" && targetRole === "MANAGER") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Managers can only promote users to OPERATOR role",
        }),
      );
    }

    // Only MASTER_ADMIN and MANAGER can promote (enforced by roleChecker middleware)
    // But double-check here for safety
    if (requesterRole !== "MASTER_ADMIN" && requesterRole !== "MANAGER") {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "You do not have permission to promote users",
        }),
      );
    }

    const profileResult = await checkForProfileCompletion({
      email: targetEmail,
    });

    if (!profileResult.isComplete) {
      if (profileResult.missingSteps.includes("accountProgress")) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "User does not exist",
          }),
        );
      }
      return next(
        new BadRequest().handleResponse(res, {
          info: "User has not completed profile",
        }),
      );
    }

    (
      req as VerifiedRequest<
        { body: AdminInviteSchemaType },
        AdminInviteRequestWithTargetUser
      >
    ).targetAdminUser = {
      targetUserId: profileResult.userId!,
      targetRole: targetRole,
    };

    next();
  },
);
