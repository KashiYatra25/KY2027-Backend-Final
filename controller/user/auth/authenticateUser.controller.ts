import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import type { UserAuthSchemaType } from "@schemas/user/userAuth.schema.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { prisma } from "@root/prisma.js";
import {
  AccountProgressModel,
  IpSecurityModel,
} from "@lib/mongo/index.js";

/**
 * Authenticate user - creates or updates user record
 */
export const authenticateUser = catchAsync(
  async (
    req: VerifiedRequest<{ body: UserAuthSchemaType }>,
    res: Response,
  ) => {
    const { email, slugName, id, avatarUrl } = req.validatedData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const isNewUser = !existingUser;

    const [user, progress, _ipSecurity] = await Promise.all([
      // Prisma operation
      prisma.user.upsert({
        where: { email },
        update: {
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

      // MongoDB operations (non-transactional for compatibility)
      AccountProgressModel.findOneAndUpdate(
        { userId: id },
        { userId: id },
        { upsert: true, returnDocument: "after" },
      ),

      IpSecurityModel.create({
        userId: id,
        ipAddress:
          (req.headers["x-forwarded-for"] as string)
            ?.split(",")[0]
            ?.trim() ||
          req.ip ||
          "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      }),
    ]);

    new OkResponseStrategy().handleResponse(res, {
      info: "User authenticated successfully",
      user: {
        role: user.role,
        accountStatus: progress?.accountStatus,
        isNewUser,
      },
    });
  },
);
