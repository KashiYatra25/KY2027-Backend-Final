import type { Request } from "express";
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

  try {
    const user = await decodeAndFindUser(sessionToken);

    if (!user) {
      return { user: null, req };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role!,
      },
      req,
    };
  } catch {
    return { user: null, req };
  }
}
