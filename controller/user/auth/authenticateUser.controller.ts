import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel, IpSecurityModel } from "@lib/mongo/index.js";
import type { GoogleVerifiedRequest } from "@root/middleware/user/auth/index.js";

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATE USER
//
// Expects: verifyGoogleTokenMiddleware to have run before this controller
// and attached req.googleData with verified Google user data.
//
// Flow:
// 1. Extract verified user data from req.googleData
// 2. Create or update user with VERIFIED data only
// 3. Track IP for security
// ═══════════════════════════════════════════════════════════════════

export const authenticateUser = catchAsync(
  async (req: GoogleVerifiedRequest, res: Response) => {
    const { id: googleUserId, email, picture } = req.googleData;

    const slugName: string = email.split("@")[0] as string;
    const isFromIITBhu: boolean = email.endsWith("itbhu.ac.in");

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Check if user exists
    // ─────────────────────────────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const isNewUser = !existingUser;

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Create or update user with VERIFIED data
    // ─────────────────────────────────────────────────────────────────

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        ...(picture && { googleAvatarUrl: picture }),
      },
      create: {
        id: googleUserId,
        email: email,
        slugName: slugName,
        googleAvatarUrl: picture ?? undefined,
        role: { create: { level: "USER" } },
        isFromIITBhu: isFromIITBhu,
      },
      include: {
        role: true,
      },
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 3: MongoDB operations (parallel)
    // ─────────────────────────────────────────────────────────────────
    const [progress] = await Promise.all([
      AccountProgressModel.findOneAndUpdate(
        { userId: googleUserId },
        { userId: googleUserId },
        { upsert: true, returnDocument: "after" },
      ),

      IpSecurityModel.create({
        userId: googleUserId,
        ipAddress: req.ip ?? "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      }),
    ]);

    const roleLevel = user.role?.level;

    if (isNewUser) {
      logger.info("New user registered via Google OAuth", {
        userId: user.id,
        email: user.email,
        role: roleLevel,
        isFromIITBhu,
      });
    } else {
      logger.debug("Returning user authenticated via Google OAuth", {
        userId: user.id,
        role: roleLevel,
      });
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "User authenticated successfully",
      role: user.role,
      accountStatus: progress?.accountStatus,
      isNewUser,
    });
  },
);
