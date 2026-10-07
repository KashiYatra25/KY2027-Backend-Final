import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import type { UserAuthSchemaType } from "@root/controller/middleware/schemas/user/user.auth.schema.js";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/index.js";
import { AccountProgressModel, IpSecurityModel, PurchaseModel } from "@lib/mongo/index.js";

/**
 * Authenticate user - creates or updates user record
 */
export const authenticateUser = catchAsync(
  async (req: VerifiedRequest<{ body: UserAuthSchemaType }>, res: Response) => {
    const { email, slugName, id, avatarUrl } = req.validatedData;
    let isFromIITBhu = false;

    if (email.endsWith("itbhu.ac.in")) {
      isFromIITBhu = true;
    }

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
          ...(avatarUrl && { googleAvatarUrl: avatarUrl }),
        },
        create: {
          id,
          email,
          slugName,
          googleAvatarUrl: avatarUrl || null,
          role: { create: { level: "USER" } },
          isFromIITBhu,
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
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.ip ||
          "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      }),
    ]);

    if (isNewUser) {
      logger.info("New user registered", {
        userId: user.id,
        email: user.email,
        role: user.role?.level,
      });

      // Auto-create free purchase for IIT BHU users
      if (isFromIITBhu) {
        await PurchaseModel.create({
          userId: user.id,
          orderId: `IITBHU-FREE-${user.id}`,
          items: [{ passId: "iitbhu-free-pass", quantity: 1 }],
          totalAmount: 0,
          paymentMethod: "IIT_BHU_FREE",
          purchasedAt: new Date(),
        });
        logger.info("Auto-created free pass for IIT BHU user", {
          userId: user.id,
          email: user.email,
        });
      }
    } else {
      logger.debug("Returning user authenticated", {
        userId: user.id,
        role: user.role?.level,
      });
    }

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
