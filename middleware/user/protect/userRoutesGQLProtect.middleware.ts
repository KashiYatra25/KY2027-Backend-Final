import type { Request } from "express";
import { GraphQLError } from "graphql";
import type { GqlGlobalContext } from "@gql/engine/engine.js";
import { extractSessionToken, decodeAndFindUser } from "./helper/functions/session.helper.js";

/**
 * GraphQL context factory
 * Creates context with authenticated user for GraphQL resolvers
 */
export async function userRoutesGQLProtectMiddleware({
  req,
}: {
  req: Request;
}): Promise<GqlGlobalContext> {
  const sessionToken = extractSessionToken(req);

  if (!sessionToken) {
    return { user: null, req };
  }

  let user;
  try {
    user = await decodeAndFindUser(sessionToken);
  } catch {
    // Invalid/expired token -> treat as unauthenticated
    return { user: null, req };
  }

  if (!user) {
    return { user: null, req };
  }

  // ═══════════════════════════════════════════════════════════════════
  // H7 FIX: Block suspended users from accessing GraphQL resolvers.
  // Thrown OUTSIDE the token try/catch so it is not swallowed.
  // ═══════════════════════════════════════════════════════════════════
  if (user.isSuspended) {
    throw new GraphQLError("Your account has been suspended.", {
      extensions: { code: "FORBIDDEN", http: { status: 403 } },
    });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role!,
    },
    req,
  };
}
