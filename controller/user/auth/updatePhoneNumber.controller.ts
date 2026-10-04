import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import type { ChangePhoneNumberSchemaType } from "@schemas/user/userAuth.schema.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import { prisma } from "@root/prisma.js";

/**
 * Update phone number - CSRF validated via middleware
 */
export const updatePhoneNumber = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ChangePhoneNumberSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
  ) => {
    const { id: userId } = req.user;
    const { newPhoneNumber } = req.validatedData;

    await prisma.user.update({
      where: { id: userId },
      data: { phone: newPhoneNumber },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Phone Number updated successfully.",
    });
  },
);
