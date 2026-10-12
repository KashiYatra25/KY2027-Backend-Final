import { prisma } from "@root/prisma.js";
import { MiddlewareChainPipeline } from "gql-axon";
import { catchGqlAsync } from "gql-axon/errors";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import { type MyAccountResponse, type UserValidatedContextType } from "@gql/helper/types/index.js";
import { myProfileGuard, isAuthenticatedGuard } from "@gql/middleware/index.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY ACCOUNT RESOLVER
// Returns combined user profile (Prisma) + account progress (MongoDB)
//
// Step Order: College (1) → Aadhaar Upload (2) → Aadhaar Verify (3) → Phone (4)
// ═══════════════════════════════════════════════════════════════════

export const getMyAccountResolver = new MiddlewareChainPipeline()
  .pipe(myProfileGuard)
  .pipe(isAuthenticatedGuard)
  .execute<UserValidatedContextType, GqlGlobalContext, MyAccountResponse>(
    catchGqlAsync(async (_parent, _args: unknown, context, _info) => {
      const userId = context.validatedContext.user!.id;

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

      // Calculate progress
      // Step completion flags
      const steps = {
        aadhaarUploaded:
          accountProgress?.profileCompletionAndVerification
            ?.hasAadhaarBeenUploaded ?? false,
        aadhaarVerified:
          accountProgress?.profileCompletionAndVerification
            ?.hasAadhaarBeenVerified ?? false,
        college:
          accountProgress?.profileCompletionAndVerification
            ?.hasSelectedCollegeDetails ?? false,
        phone:
          accountProgress?.profileCompletionAndVerification
            ?.hasVerifiedPhoneNumber ?? false,
      };

      // ─────────────────────────────────────────────────────────────────
      // Calculate currentStep based on NEW order:
      // Step 1: College
      // Step 2: Aadhaar Upload
      // Step 3: Aadhaar Verify
      // Step 4: Phone
      // Step 5: All complete (redirect to profile)
      // ─────────────────────────────────────────────────────────────────
      let currentStep: number;
      if (!steps.college) {
        currentStep = 1; // College step
      } else if (!steps.aadhaarUploaded) {
        currentStep = 2; // Aadhaar upload step
      } else if (!steps.aadhaarVerified) {
        currentStep = 3; // Aadhaar verify step
      } else if (!steps.phone) {
        currentStep = 4; // Phone step
      } else {
        currentStep = 5; // All complete
      }

      const completedSteps = Object.values(steps).filter(Boolean).length;
      const totalSteps = 4;
      const completionPercentage = Math.round(
        (completedSteps / totalSteps) * 100
      );
      const isProfileComplete = completedSteps === totalSteps;

      return {
        profile: {
          ...user,
          dob: user.dob?.toISOString() ?? null,
          joinedAt: user.createdAt.toISOString(),
        },
        progress: {
          steps,
          currentStep,
          completedSteps,
          totalSteps,
          completionPercentage,
          isProfileComplete,
          accountStatus:
            (accountProgress?.accountStatus as "ACTIVE" | "SUSPENDED") ??
            "ACTIVE",
        },
      };
    })
  );
