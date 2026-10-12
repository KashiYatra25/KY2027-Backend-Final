import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { prisma } from "@root/prisma.js";
import { VerificationTokenModel } from "@root/databaseManagers/mongoose/index.js";
import { CryptoService } from "@helper/functions/crypto.helper.js";
import { queueForgotPasswordEmail } from "@services/queue/index.js";
import { env } from "@lib/env/environment.js";
import type { ForgotPasswordRequestSchemaType } from "@schemas/admin/forgotPassword.schema.js";

// ═══════════════════════════════════════════════════════════════════
// FORGOT PASSWORD CONTROLLER
//
// Public endpoint - no auth required.
// User submits email to receive password reset link.
//
// Flow:
// 1. Find admin by email
// 2. If not found, return success anyway (security - don't reveal if email exists)
// 3. Generate random token
// 4. Hash and store token with 10 minute expiry
// 5. Send email with reset link
// 6. Return generic success message
//
// Security:
// - Always returns success (doesn't reveal if email exists)
// - Token is hashed before storing
// - Token expires in 10 minutes
// - Old tokens for same user are deleted
// ═══════════════════════════════════════════════════════════════════

const TOKEN_EXPIRY_MINUTES = 10;

export const forgotPassword = catchAsync(
  async (
    req: VerifiedRequest<{ body: ForgotPasswordRequestSchemaType }>,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const { email } = req.validatedData;

    // Generic success response - used for both found and not found cases
    const successResponse = () => {
      new OkResponseStrategy().handleResponse(res, {
        info: "If your email is registered, you will receive a password reset link shortly.",
      });
    };

    // ─────────────────────────────────────────────────────────────────
    // Step 1: Find user by email
    // ─────────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        slugName: true,
        admin: {
          select: { id: true },
        },
        role: {
          select: { level: true },
        },
      },
    });

    // If user not found or not an admin, return success anyway (security)
    if (!user || !user.admin || !user.role || user.role.level === "USER") {
      logger.debug("Forgot password - user not found or not admin", { email });
      return successResponse();
    }

    const userId = user.id;

    // ─────────────────────────────────────────────────────────────────
    // Step 2: Delete any existing forgot password tokens for this user
    // ─────────────────────────────────────────────────────────────────
    await VerificationTokenModel.deleteMany({
      userId,
      tokenType: "ADMIN_FORGOT_PASSWORD",
    });

    // ─────────────────────────────────────────────────────────────────
    // Step 3: Generate new token
    // ─────────────────────────────────────────────────────────────────
    const rawToken = CryptoService.generateRandomToken(32);
    const hashedToken = await CryptoService.hash(rawToken);

    // ─────────────────────────────────────────────────────────────────
    // Step 4: Store hashed token with expiry
    // ─────────────────────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await VerificationTokenModel.create({
      userId,
      tokenType: "ADMIN_FORGOT_PASSWORD",
      tokenValue: hashedToken,
      expiresAt,
    });

    logger.debug("Forgot password token created", { userId, expiresAt });

    // ─────────────────────────────────────────────────────────────────
    // Step 5: Build reset URL and queue email
    // ─────────────────────────────────────────────────────────────────
    const resetUrl = `${env.CLIENT_ADMIN_PANEL_ORIGIN}/update-password/${rawToken}`;

    await queueForgotPasswordEmail({
      userName: user.firstName || user.slugName || "Admin",
      email: user.email,
      resetUrl,
    });

    logger.info("Forgot password email queued", { userId, email });

    // ─────────────────────────────────────────────────────────────────
    // Step 6: Return success
    // ─────────────────────────────────────────────────────────────────
    return successResponse();
  },
);
