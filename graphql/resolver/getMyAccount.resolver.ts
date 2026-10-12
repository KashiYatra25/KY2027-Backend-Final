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
      const completedSteps = Object.values(steps).filter(Boolean).length;
      const totalSteps = 4;
      const currentStep = completedSteps + 1; // Next step to complete
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
