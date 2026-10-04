import { checkForProfileCompletion } from "@controller/helper/checkWhetherProfileIsCompleted";
import type { AdminInviteSchemaType } from "@schemas/admin/admin.schema";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper";
import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest } from "zodex-axon/errors";
import type { AdminInviteRequestWithTargetUser } from "./types";

/**
 * Middleware to validate target user exists and has completed profile
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
    const { targetEmail, role } = req.validatedData;

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
      targetRole: role,
    };

    next();
  },
);
