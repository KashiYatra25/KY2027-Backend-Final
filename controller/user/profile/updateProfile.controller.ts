import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { ProfileUpdationRequestSchemaType } from "@schemas/user/profile.schema.js";

/**
 * PATCH /user/profile
 * Update user's profile (phoneNumber and/or college)
 *
 * Note: 
 * - IIT BHU users (isFromIITBhu: true) cannot change their college
 * - Post-save hooks on AccountProgress handle:
 *   - Auto-setting isPaidUser for IIT BHU users
 *   - Generating kyId on profile completion
 */
const updateProfile = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ProfileUpdationRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next,
  ) => {
    const { id: userId } = req.user;
    const { phoneNumber, college } = req.validatedData;

    // ─────────────────────────────────────────────────────────────────
    // Security Check: Block IIT BHU users from changing college
    // ─────────────────────────────────────────────────────────────────
    if (college) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isFromIITBhu: true, college: true },
      });

      if (user?.isFromIITBhu) {
        return next(
          new BadRequest().handleResponse(res, {
            info: "IIT BHU students cannot change their college. Your college has been automatically set based on your institute email.",
          })
        );
      }
    }

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
