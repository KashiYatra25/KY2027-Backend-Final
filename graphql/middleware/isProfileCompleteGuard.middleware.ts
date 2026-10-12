import { BadRequestError } from "gql-axon/errors";
import { checkForProfileCompletion } from "@controller/helper/index.js";
import { type UserValidatedContextType } from "@gql/helper/types/index.js";

// ═══════════════════════════════════════════════════════════════════
// IS PROFILE COMPLETE GUARD
// Throws if user's profile is not complete
// Use this for features that require completed profile (CA application, etc.)
// ═══════════════════════════════════════════════════════════════════

export const isProfileCompleteGuard = async (
  _parent: unknown,
  _args: unknown,
  context: { validatedContext: UserValidatedContextType },
  _info: unknown
) => {
  const userId = context.validatedContext.user?.id;

  if (!userId) {
    throw new BadRequestError("Authentication required");
  }

  const profileResult = await checkForProfileCompletion({ userId });

  if (!profileResult.isComplete) {
    throw new BadRequestError(
      `Profile incomplete. Missing steps: ${profileResult.missingSteps.join(", ")}`
    );
  }
};
