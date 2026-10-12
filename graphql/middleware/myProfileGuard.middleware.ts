import { RequestGuardMiddleware as GqlRequestGuardMiddleware } from "gql-axon";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import {
  userContextSchema,
  type UserValidatedContextType,
} from "@gql/helper/types/index.js";

// ═══════════════════════════════════════════════════════════════════
// MY PROFILE GUARD
// Validates the structure of the user context
// ═══════════════════════════════════════════════════════════════════

export const myProfileGuard = GqlRequestGuardMiddleware<
  { context: UserValidatedContextType },
  GqlGlobalContext
>({
  context: userContextSchema,
});
