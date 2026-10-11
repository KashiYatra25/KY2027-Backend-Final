import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ProfileUpdationRequestSchemaType } from "@schemas/user/profile.schema.js";
import { autoSetPaidForIITBhuUser } from "@root/controller/helper/index.js";

/**
 * PATCH /user/profile
 * Update user's profile (phoneNumber and/or college)
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

    // Auto-set isPaidUser for IIT BHU users if profile is now complete
    const autoSetPaid = await autoSetPaidForIITBhuUser(userId);
    if (autoSetPaid) {
      logger.info(
        "Auto-set isPaidUser for IIT BHU user after profile completion",
        { userId },
      );
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
