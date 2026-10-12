import { BadRequestError } from "gql-axon/errors";
import { type UserValidatedContextType } from "@gql/helper/types/index.js";

// ═══════════════════════════════════════════════════════════════════
// IS AUTHENTICATED GUARD
// Throws if user is not authenticated
// This runs after myProfileGuard which puts validated data in context.validatedContext
// ═══════════════════════════════════════════════════════════════════

export const isAuthenticatedGuard = async (
  _parent: unknown,
  _args: unknown,
  context: { validatedContext: UserValidatedContextType },
  _info: unknown
) => {
  if (!context.validatedContext.user) {
    throw new BadRequestError("Authentication required");
  }
};
