// Phone number update controller is commented out since phone updates are not being used currently
// If in the future we plan to allow phone number updates, we will uncomment this section

/*
import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import type { ChangePhoneNumberSchemaType } from "@root/controller/middleware/schemas/user/user.auth.schema.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import { prisma } from "@root/prisma.js";

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
*/
