import type { Response } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import { OkResponseStrategy } from "zodex-axon/responses";
import { logger } from "@logger/logger.js";
import { AccountProgressModel } from "@lib/mongo/user/accountProgress.model.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { SelectIdentityMethodRequestSchemaType } from "@schemas/user/profile.schema.js";

/**
 * POST /user/profile/identity-method
 *
 * Commits the user's identity-verification method (aadhaar | manual) the
 * moment they begin that flow, and LOCKS it so the choice cannot be switched
 * mid-way or after a refresh.
 *
 * Locking rules:
 *   - If identity is already verified → locked (409).
 *   - If a method is already set:
 *       - same method  → idempotent OK (allows resuming the flow).
 *       - different one → rejected (409). The choice is final.
 *   - Otherwise → set the method and return it.
 */
const selectIdentityMethod = catchAsync(
  async (
    req: VerifiedRequest<
      { body: SelectIdentityMethodRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next,
  ) => {
    const { id: userId } = req.user;
    const { method } = req.validatedData;

    const progress = await AccountProgressModel.findOne({ userId });

    if (!progress) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Account progress not found. Please complete the earlier steps first.",
        }),
      );
    }

    const verification = progress.profileCompletionAndVerification;

    // Already verified → fully locked.
    if (verification?.hasIdentityBeenVerified) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "Identity is already verified and cannot be changed.",
          method: verification.identityVerificationMethod,
          locked: true,
        }),
      );
    }

    const existingMethod = verification?.identityVerificationMethod ?? null;

    // A method is already committed.
    if (existingMethod) {
      if (existingMethod === method) {
        // Idempotent: allow resuming the same flow.
        new OkResponseStrategy().handleResponse(res, {
          info: "Identity method already selected.",
          method: existingMethod,
          locked: true,
        });
        return;
      }

      // EXCEPTION: Aadhaar auto-upload is disabled (AWS/Textract unavailable),
      // so an unverified user previously committed to "aadhaar" MUST be allowed
      // to switch to "manual" to finish verification. Any other switch stays
      // final. (hasIdentityBeenVerified is already handled above.)
      const switchingAadhaarToManual =
        existingMethod === "aadhaar" && method === "manual";

      if (!switchingAadhaarToManual) {
        // The choice is final for every other transition → reject.
        return next(
          new ForbiddenErrorResponse().handleResponse(res, {
            info: "You have already chosen a verification method and it cannot be changed.",
            method: existingMethod,
            locked: true,
          }),
        );
      }

      // Fall through: migrate aadhaar → manual below.
    }

    // First-time selection (or the allowed aadhaar→manual migration) → commit.
    verification!.identityVerificationMethod = method;
    await progress.save();

    logger.info("Identity verification method committed", { userId, method });

    new OkResponseStrategy().handleResponse(res, {
      info: "Identity method selected successfully.",
      method,
      locked: true,
    });
  },
);

export { selectIdentityMethod };
