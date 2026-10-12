import { prisma } from "@root/prisma.js";
import { MiddlewareChainPipeline } from "gql-axon";
import { catchGqlAsync } from "gql-axon/errors";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import { type MyCaInfoResponse, type UserValidatedContextType } from "@gql/helper/types/index.js";
import {
  myProfileGuard,
  isAuthenticatedGuard,
  isProfileCompleteGuard,
} from "@gql/middleware/index.js";

// ═══════════════════════════════════════════════════════════════════
// GET MY CA INFO RESOLVER
// Returns CA application + profile data
// Requires: Authentication + Profile Completion
// Frontend queries only the fields it needs
// ═══════════════════════════════════════════════════════════════════

export const getMyCaInfoResolver = new MiddlewareChainPipeline()
  .pipe(myProfileGuard)
  .pipe(isAuthenticatedGuard)
  .pipe(isProfileCompleteGuard)
  .execute<UserValidatedContextType, GqlGlobalContext, MyCaInfoResponse>(
    catchGqlAsync(async (_parent, _args: unknown, context, _info) => {
      const userId = context.validatedContext.user!.id;

      // Fetch CA application and profile
      const caData = await prisma.caApplication.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
          updatedAt: true,
          caProfile: {
            select: {
              id: true,
              referralId: true,
              numberOfReferrals: true,
              createdAt: true,
            },
          },
        },
      });

      // No CA application exists
      if (!caData) {
        return {
          hasApplied: false,
          application: null,
          profile: null,
        };
      }

      return {
        hasApplied: true,
        application: {
          id: caData.id,
          status: caData.status,
          rejectionReason: caData.rejectionReason,
          appliedAt: caData.createdAt.toISOString(),
          updatedAt: caData.updatedAt.toISOString(),
        },
        profile: caData.caProfile
          ? {
              id: caData.caProfile.id,
              referralId: caData.caProfile.referralId,
              numberOfReferrals: caData.caProfile.numberOfReferrals,
              approvedAt: caData.caProfile.createdAt.toISOString(),
            }
          : null,
      };
    })
  );
