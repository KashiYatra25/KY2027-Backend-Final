import { AccountProgressModel } from "@root/databaseManagers/mongoose";
import type { SuspensionCheckResult } from "../types/helper.types.js";

/**
 * Check if user account is suspended (MongoDB)
 */
export const checkUserIsSuspended = async (
  userId: string,
): Promise<SuspensionCheckResult> => {
  const progress = await AccountProgressModel.findOne(
    { userId },
    { accountStatus: 1 },
  );

  if (!progress || progress.accountStatus !== "SUSPENDED") {
    return { isSuspended: false };
  }

  return {
    isSuspended: true,
  };
};
