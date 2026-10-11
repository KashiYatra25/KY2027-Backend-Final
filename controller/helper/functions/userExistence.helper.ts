import { prisma } from "@root/prisma";
import type {
  UserExistsResult,
  UserLookupParams,
} from "../types/helper.types.js";

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a user exists in Prisma (PostgreSQL)
 */
export const checkUserExists = async (
  params: UserLookupParams,
): Promise<UserExistsResult> => {
  const { userId, email } = params;

  if (!userId && !email) {
    throw new Error("Either userId or email must be provided");
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return { exists: false, user: null };
  }

  return { exists: true, user };
};
