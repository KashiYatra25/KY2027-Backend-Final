import { BadRequest, InternalServerError } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import type { NextFunction, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { CryptoService } from "@utils/helper/crypto.encryption.helper.js";
import type {
  ChangePhoneNumberSchemaType,
  UserAuthSchemaType,
} from "@middleware/schemas/user/userAuth.schema.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { type AuthenticatedUserRequestWithVerifiedEmail } from "@utils/helper/auth.types.helper.js";
import { env } from "@lib/env/environment.js";
import { prisma } from "@root/prisma.js"
import { AccountProgressModel, IpSecurityModel, VerificationTokenModel } from "@root/databaseManagers/mongoose";

const authenticateUser = catchAsync(
  async (
    req: VerifiedRequest<{ body: UserAuthSchemaType }>,
    res: Response,
    next: NextFunction,
  ) => {
    const { email, slugName, id, avatarUrl } = req.validatedData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const isNewUser = !existingUser;

    const [user] = await Promise.all([
      prisma.user.upsert({
        where: { email },
        update: {
          // Update avatar if provided (user might have changed their Google profile pic)
          ...(avatarUrl && { avatarUrl }),
        },
        create: {
          id,
          email,
          slugName,
          avatarUrl: avatarUrl || null,
          role: { create: { level: "USER" } },
        },
        include: {
          role: {
            select: {
              level: true,
            },
          },
        },
      }),
      AccountProgressModel.findOneAndUpdate(
        { userId: id },
        { userId: id },
        { upsert: true, returnDocument: "after" },
      ),
      IpSecurityModel.create({
        userId: id,
        ipAddress:
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.ip ||
          "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      }),
    ]);

    // Format response to match frontend AuthenticateResponse interface
    new OkResponseStrategy().handleResponse(res, {
      info: "User authenticated successfully",
      user: {
        email: user.email,
        slugName: user.slugName,
      },
      isNewUser,
    });
  },
);

const initiatePhoneNumberChange = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    const randomTokenSalt = crypto.randomBytes(16).toString("hex");
    const encryptedCSRFToken = CryptoService.encrypt(randomTokenSalt);
    const hashedCSRFToken = await bcrypt.hash(encryptedCSRFToken, 10);

    const csrfTokenDoc = await VerificationTokenModel.create({
      userId,
      tokenType: "CSRF_TOKEN",
      tokenValue: hashedCSRFToken,
      expiresAt: new Date(Date.now() + Number(env.CSRF_TOKEN_EXPIRATION_TIME)),
    });

    if (!csrfTokenDoc) {
      return next(
        new InternalServerError().handleResponse(res, {
          info: "Failed to proceed phone number change.",
        }),
      );
    }

    res.setHeader(env.CSRF_TOKEN_HEADER_NAME, encryptedCSRFToken);

    new OkResponseStrategy().handleResponse(res, {
      info: "Phone Number change initiation successful.",
    });
  },
);

const updatePhoneNumber = catchAsync(
  async (
    req: VerifiedRequest<
      { body: ChangePhoneNumberSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;
    const { newPhoneNumber } = req.validatedData;
    const { [env.CSRF_TOKEN_HEADER_NAME]: csrfToken } = req.headers;

    if (!csrfToken || typeof csrfToken !== "string") {
      return next(
        new BadRequest().handleResponse(res, {
          info: "CSRF token is missing or invalid.",
        }),
      );
    }

    // we have to actually fetch the latest token so that user cannot use any old  token to change the phone number. This is important for security.

    const csrfTokenDoc = await VerificationTokenModel.findOne({
      userId,
      tokenType: "CSRF_TOKEN",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select("+tokenValue");

    if (!csrfTokenDoc) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid or expired CSRF token.",
        }),
      );
    }

    const decryptedCSRFToken = CryptoService.decrypt(csrfToken);
    const isValid = await bcrypt.compare(
      decryptedCSRFToken,
      csrfTokenDoc.tokenValue,
    );

    if (!isValid) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Invalid CSRF token.",
        }),
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { phone: newPhoneNumber },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Phone Number updated successfully.",
    });
  },
);

export { initiatePhoneNumberChange, updatePhoneNumber, authenticateUser };
