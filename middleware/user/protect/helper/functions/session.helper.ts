import type { Request } from "express";
import { decode } from "next-auth/jwt";
import { env } from "@lib/env/environment.js";
import { prisma } from "@root/prisma.js";
import type { DecodedUser } from "@middleware/user/protect/helper/types/protect.types.js";

/**
 * Extract NextAuth session token from request cookies
 */
export function extractSessionToken(req: Request): string | undefined {
  return (
    req.cookies["next-auth.session-token"] ||
    req.cookies["__Secure-next-auth.session-token"]
  );
}

/**
 * Decode session token and find user in database
 * Returns user data or null if invalid
 */
export async function decodeAndFindUser(
  sessionToken: string
): Promise<DecodedUser | null> {
  const decoded = await decode({ token: sessionToken, secret: env.JWT_SECRET });

  const userId = decoded?.id as string;
  const email = decoded?.email as string;

  if (!decoded || !userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId, email },
    select: {
      id: true,
      email: true,
      phone: true,
      role: { select: { level: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role?.level ?? null,
  };
}
