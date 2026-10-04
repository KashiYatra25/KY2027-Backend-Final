import { BadRequest } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { CryptoService } from "@utils/helper/crypto.encryption.helper.js";
import { prisma } from "../../../prisma.js";
import type {
  OtpGenerationSchemaType,
  OtpVerificationSchemaType,
} from "@root/controller/middleware/schemas/user/otp.schema.js";
import { generateOtp as createOtp } from "@utils/basic.func.helper.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import type { NextFunction, Response } from "express";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import {
  AccountProgressModel,
  VerificationTokenModel,
} from "@root/databaseManagers/mongoose/index.js";

const getOtp = catchAsync(
  async (
    req: VerifiedRequest<
      { body: OtpGenerationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const userId = req.user.id;
    const { phoneNumber } = req.validatedData;

    const otp = createOtp({ prefix: "OTP" });
    const hashedOtp = await CryptoService.hash(otp);

    // We have to use some kind of otp service.
    // const message = `Your Data Avengers LMS verification OTP is: ${otp}\n\nThis OTP is valid for 1 minute only.\nDo not share this OTP with anyone.\n\nIf you didn't request this, contact us at info@dataavengers.in.\n❤️ from the team of Data Avengers\n`;

    // const isSent = await smsService.sendSms(phoneNumber, message);

    // if (!isSent) {
    //   return next(
    //     new BadRequest().handleResponse(res, {
    //       info: "Unable to send the OTP, please try again",
    //     }),
    //   );
    // }

    await VerificationTokenModel.create({
      tokenType: "PHONE_NUMBER_VERIFICATION_TOKEN",
      tokenValue: hashedOtp,
      userId,
      expiresAt: new Date(Date.now() + 60 * 1000),
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "OTP sent successfully",
    });
  },
);

const verifyOtp = catchAsync(
  async (
    req: VerifiedRequest<
      { body: OtpVerificationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const userId = req.user.id;
    const { otp, phoneNumber } = req.validatedData;
    const formattedOtp = "OTP-".concat(otp);

    const storedToken = await VerificationTokenModel.findOne({
      userId,
      tokenType: "PHONE_NUMBER_VERIFICATION_TOKEN",
      expiresAt: { $gt: new Date() },
    })
      .select("+tokenValue")
      .sort({ createdAt: -1 });

    if (!storedToken) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "OTP not found or has expired",
        }),
      );
    }

    const doesMatch = await CryptoService.verify(
      formattedOtp,
      storedToken.tokenValue,
    );

    if (!doesMatch) {
      return next(
        new BadRequest().handleResponse(res, { info: "Invalid OTP" }),
      );
    }

    // Expire token immediately after use

    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: { phone: phoneNumber, status: "ACTIVE" },
      }),
      AccountProgressModel.updateOne(
        { userId },
        { phoneVerificationStatus: "VERIFICATION_COMPLETED" },
      ),
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: "OTP verified successfully",
    });
  },
);

export { getOtp, verifyOtp };
