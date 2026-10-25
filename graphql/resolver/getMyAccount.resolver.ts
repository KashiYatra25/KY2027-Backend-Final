import { prisma } from "@root/prisma.js";
import { MiddlewareChainPipeline } from "gql-axon";
import { catchGqlAsync } from "gql-axon/errors";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import { type MyAccountResponse, type UserValidatedContextType } from "@gql/helper/types/index.js";
import { myProfileGuard, isAuthenticatedGuard } from "@gql/middleware/index.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import { getCached, setCached, logCacheHit } from "@redis/entityCache.service.js";
import { getMyAccountCacheKey } from "@redis/keys/redis.keys.js";
import { logger } from "@logger/logger.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY ACCOUNT RESOLVER
// Returns combined user profile (Prisma) + account progress (MongoDB)
//
// Step Order: College (1) → Identity (2) → Phone (3)
// Identity can be completed via Aadhaar OR Manual entry
// ═══════════════════════════════════════════════════════════════════

export const getMyAccountResolver = new MiddlewareChainPipeline()
  .pipe(myProfileGuard)
  .pipe(isAuthenticatedGuard)
  .execute<UserValidatedContextType, GqlGlobalContext, MyAccountResponse>(
    catchGqlAsync(async (_parent, _args: unknown, context, _info) => {
      const userId = context.validatedContext.user!.id;

      // ── Read-through cache: return the cached response on hit ──
      const cacheKey = getMyAccountCacheKey(userId);
      const cached = await getCached<MyAccountResponse>(cacheKey);
      if (cached) {
        logCacheHit("profile");
        return cached;
      }

      // Fetch user profile from PostgreSQL (Prisma)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          slugName: true,
          candidatePhotoUrl: true,
          googleAvatarUrl: true,
          phone: true,
          gender: true,
          college: true,
          dob: true,
          createdAt: true,
          aadhaarNumber: true,
          isFromIITBhu: true,
          isPaidUser: true,
          kyId: true,
          // Check if user is a Campus Ambassador
          caProfile: {
            select: { id: true },
          },
          // Referral: who referred this user (CA's name), if any.
          referredByCa: {
            select: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          role: {
            select: {
              id: true,
              level: true,
            },
          },
        },
      });

      if (!user) return null;

      // Fetch account progress from MongoDB
      const accountProgress = await AccountProgressModel.findOne({ userId });

      // Step completion flags (new 3-step system)
      const steps = {
        college:
          accountProgress?.profileCompletionAndVerification
            ?.hasSelectedCollegeDetails ?? false,
        identity:
          accountProgress?.profileCompletionAndVerification
            ?.hasIdentityBeenVerified ?? false,
        phone:
          accountProgress?.profileCompletionAndVerification
            ?.hasVerifiedPhoneNumber ?? false,
      };

      // Track identity verification method (aadhaar or manual)
      const identityVerificationMethod =
        accountProgress?.profileCompletionAndVerification
          ?.identityVerificationMethod ?? null;

      // ─────────────────────────────────────────────────────────────────
      // Calculate currentStep based on 3-step order:
      // Step 1: College
      // Step 2: Identity (Aadhaar OR Manual)
      // Step 3: Phone
      // Step 4: All complete (redirect to profile)
      // ─────────────────────────────────────────────────────────────────
      let currentStep: number;
      if (!steps.college) {
        currentStep = 1; // College step
      } else if (!steps.identity) {
        currentStep = 2; // Identity verification step
      } else if (!steps.phone) {
        currentStep = 3; // Phone step
      } else {
        currentStep = 4; // All complete
      }

      const completedSteps = Object.values(steps).filter(Boolean).length;
      const totalSteps = 3;
      const completionPercentage = Math.round(
        (completedSteps / totalSteps) * 100
      );
      const isProfileComplete = completedSteps === totalSteps;

      // ─────────────────────────────────────────────────────────────────
      // Lazy KY ID assignment: If profile is complete but no kyId, assign now.
      // This catches users who completed profile before kyIdService was fixed.
      // ─────────────────────────────────────────────────────────────────
      let kyId = user.kyId;
      const isPaidUser = user.isPaidUser;
      
      if (isProfileComplete) {
        // Lazy-assign kyId if missing
        if (!kyId) {
          try {
            const { generateUniqueKyId } = await import("@services/kyId/index.js");
            kyId = await generateUniqueKyId();
            
            await prisma.user.update({
              where: { id: userId },
              data: { kyId },
            });
            
            logger.info("Lazy-assigned kyId on profile fetch", { userId, kyId });
          } catch (error) {
            logger.error("Failed to lazy-assign kyId", {
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Resolve the referrer's display name (if a CA referral was applied).
      const { referredByCa, caProfile, ...userFields } = user;
      const referredBy = referredByCa?.user
        ? [referredByCa.user.firstName, referredByCa.user.lastName]
            .filter(Boolean)
            .join(" ") || "Campus Ambassador"
        : null;
      const isCa = !!caProfile;

      const response: MyAccountResponse = {
        profile: {
          ...userFields,
          kyId, // Use potentially lazy-assigned kyId
          isPaidUser, // Use potentially lazy-assigned isPaidUser
          dob: user.dob?.toISOString() ?? null,
          joinedAt: user.createdAt.toISOString(),
          referredBy,
          isCa,
        },
        progress: {
          steps,
          currentStep,
          completedSteps,
          totalSteps,
          completionPercentage,
          isProfileComplete,
          identityVerificationMethod,
          accountStatus:
            (accountProgress?.accountStatus as "ACTIVE" | "SUSPENDED") ??
            "ACTIVE",
        },
      };

      // Populate cache (fire-and-forget; safe on Redis failure).
      await setCached(cacheKey, response);

      return response;
    })
  );
