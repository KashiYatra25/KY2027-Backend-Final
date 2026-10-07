import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/index.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { ProfileUpdationSchemaType } from "@schemas/user/profile.schema.js";

/**
 * PATCH /user/profile
 * Update user's profile (phoneNumber and/or college)
 */
const updateProfile = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ProfileUpdationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { phoneNumber, college } = req.validatedData;



    // Build update data for Prisma
    const updateData: { phone?: string; college?: string } = {};
    if (phoneNumber) updateData.phone = phoneNumber;
    if (college) updateData.college = college;

    // Update user in Prisma
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        phone: true,
        college: true,
      },
    });

    // Update MongoDB progress flags
    const progress = await AccountProgressModel.findOne({ userId });
    if (progress) {
      if (phoneNumber) {
        progress.profileCompletionAndVerification!.hasVerifiedPhoneNumber = true;
      }
      if (college) {
        progress.profileCompletionAndVerification!.hasSelectedCollegeDetails = true;
      }
      await progress.save();
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Profile updated successfully",
      data: {
        ...(phoneNumber && { phoneNumber: updatedUser.phone }),
        ...(college && { college: updatedUser.college }),
      },
    });

    logger.info("Profile updated", {
      userId,
      updatedFields: [...(phoneNumber ? ["phone"] : []), ...(college ? ["college"] : [])],
    });
  },
);

export { updateProfile };
