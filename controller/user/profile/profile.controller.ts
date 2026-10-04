import type { NextFunction, Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import type { UpdateProfileSchemaType } from "@root/controller/middleware/schemas/user/profile.schema";
import { ForbiddenErrorResponse } from "zodex-axon/errors";
import { checkForProfileCompletion } from "@root/controller/helper/checkWhetherProfileIsCompleted";

/**
 * PATCH /user/profile
 * Update user's college
 */
const updateProfile = catchAsync(
  async (
    req: VerifiedRequest<
      { body: UpdateProfileSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { college } = req.validatedData;

    // Update user's college in Prisma
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { college },
      select: {
        id: true,
        college: true,
      },
    });

    // Mark college as completed in MongoDB
    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      progress.profileCompletionAndVerification!.hasSelectedCollegeDetails = true;
      await progress.save();
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "College updated successfully",
      data: updatedUser,
    });
  },
);

export { updateProfile };
