import type { Request } from "express";
import { decode } from "next-auth/jwt";
import { env } from "@lib/env/environment.js";

export async function extractNextAuthUserId(
  req: Request,
): Promise<string | null> {
  try {
    const sessionToken =
      req.cookies["next-auth.session-token"] ||
      req.cookies["__Secure-next-auth.session-token"];
    if (!sessionToken) return null;
    const decoded = await decode({
      token: sessionToken,
      secret: env.JWT_SECRET,
    });
    return (decoded?.id as string) || null;
  } catch {
    return null;
  }
}
