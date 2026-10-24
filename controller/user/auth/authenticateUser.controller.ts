import { OkResponseStrategy } from "zodex-axon/responses";
import type { Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import { AccountProgressModel, IpSecurityModel } from "@lib/mongo/index.js";
import { invalidateProfileCache } from "@root/services/redis/entityCache.service.js";
import type { GoogleVerifiedRequest } from "@root/middleware/user/auth/index.js";
import { metrics } from "@services/metrics/index.js";

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const IIT_BHU_COLLEGE_NAME = "Indian Institute of Technology (BHU) Varanasi";

// ═══════════════════════════════════════════════════════════════════
// AUTHENTICATE USER
//
// Expects: verifyGoogleTokenMiddleware to have run before this controller
// and attached req.googleData with verified Google user data.
//
// Flow:
// 1. Extract verified user data from req.googleData
// 2. Create or update user with VERIFIED data only
// 3. For IIT BHU emails: auto-set college and mark college step complete
// 4. Track IP for security
// ═══════════════════════════════════════════════════════════════════

export const authenticateUser = catchAsync(
  async (req: GoogleVerifiedRequest, res: Response) => {
    const { id: googleUserId, email, picture } = req.googleData;

    const slugName: string = email.split("@")[0] as string;
    
    // Check for both @itbhu.ac.in and @iitbhu.ac.in domains
    const isFromIITBhu: boolean = email.endsWith("@itbhu.ac.in") || email.endsWith("@iitbhu.ac.in");

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Upsert user with VERIFIED data
    // For IIT BHU users: always ensure college is set
    // ─────────────────────────────────────────────────────────────────

    // Check if user exists before upsert (to track new signups)
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        ...(picture && { googleAvatarUrl: picture }),
        // Always set IIT BHU data on login for IIT BHU users
        ...(isFromIITBhu && {
          isFromIITBhu: true,
          college: IIT_BHU_COLLEGE_NAME,
        }),
      },
      create: {
        id: googleUserId,
        email: email,
        slugName: slugName,
        googleAvatarUrl: picture ?? undefined,
        role: { create: { level: "USER" } },
        isFromIITBhu: isFromIITBhu,
        ...(isFromIITBhu && { college: IIT_BHU_COLLEGE_NAME }),
      },
      include: {
        role: true,
      },
    });

    // Track new user signups
    if (!existingUser) {
      metrics.incrementUsers();
    }

    // ─────────────────────────────────────────────────────────────────
    // Step 2: MongoDB operations (parallel)
    // For IIT BHU users: always mark college step as complete
    // ─────────────────────────────────────────────────────────────────
    const [progress] = await Promise.all([
      AccountProgressModel.findOneAndUpdate(
        { userId: googleUserId },
        { 
          userId: googleUserId,
          ...(isFromIITBhu && {
            "profileCompletionAndVerification.hasSelectedCollegeDetails": true,
          }),
        },
        { upsert: true, returnDocument: "after" },
      ),

      IpSecurityModel.create({
        userId: googleUserId,
        ipAddress: req.ip ?? "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      }),
    ]);

    // AccountProgress was written via findOneAndUpdate (upsert), which does
    // NOT trigger the post-save invalidation hook — invalidate explicitly so
    // a returning user never sees a stale cached profile.
    await invalidateProfileCache(googleUserId);

    logger.info("User authenticated via Google OAuth", {
      userId: user.id,
      email: user.email,
      role: user.role?.level,
      isFromIITBhu,
      ...(isFromIITBhu && { autoSetCollege: IIT_BHU_COLLEGE_NAME }),
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "User authenticated successfully",
      role: user.role,
      accountStatus: progress?.accountStatus,
      isPaidUser: user.isPaidUser,
    });
  },
);
