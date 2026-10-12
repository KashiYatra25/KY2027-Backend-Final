import { RequestGuardMiddleware as GqlRequestGuardMiddleware } from "gql-axon";
import { type GqlGlobalContext } from "@gql/engine/engine.js";
import {
  adminContextSchema,
  type AdminValidatedContextType,
} from "@gql/helper/types/index.js";

// ═══════════════════════════════════════════════════════════════════
// ADMIN CONTEXT GUARD
// Validates the structure of the admin context
// ═══════════════════════════════════════════════════════════════════

export const adminContextGuard = GqlRequestGuardMiddleware<
  { context: AdminValidatedContextType },
  GqlGlobalContext
>({
  context: adminContextSchema,
});
