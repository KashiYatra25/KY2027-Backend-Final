import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ProfileUpdationRequestSchemaType } from "@schemas/user/profile.schema.js";

/**
 * PATCH /user/profile
 * Update user's profile (phoneNumber and/or college)
 *
 * Note: Post-save hooks on AccountProgress handle:
 * - Auto-setting isPaidUser for IIT BHU users
 * - Generating kyId on profile completion
 */
const updateProfile = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ProfileUpdationRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
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

    // Update MongoDB progress flags (post-save hooks will handle the rest)
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
      ...(phoneNumber && { phoneNumber: updatedUser.phone }),
      ...(college && { college: updatedUser.college }),
    });

    logger.info("Profile updated", {
      userId,
      updatedFields: [
        ...(phoneNumber ? ["phone"] : []),
        ...(college ? ["college"] : []),
      ],
    });
  },
);

export { updateProfile };
