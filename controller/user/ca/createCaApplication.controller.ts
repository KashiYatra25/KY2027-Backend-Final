import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";
import type { CaApplicationSchemaType } from "@schemas/user/caApplication.schema.js";

/**
 * POST /user/ca/apply
 * Create a new CA application for the authenticated user
 * Requirements:
 * - User must be authenticated
 * - User must have USER role
 * - User must have completed profile
 * - User must not have an existing application
 */
const createCaApplication = catchAsync(
  async (
    req: VerifiedRequest<
      { body: CaApplicationSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    // Check if user already has a CA application
    const existingApplication = await prisma.caApplication.findUnique({
      where: { userId },
    });

    if (existingApplication) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You have already applied for Campus Ambassador",
          data: {
            status: existingApplication.status,
            appliedAt: existingApplication.createdAt,
          },
        }),
      );
    }

    // Create new CA application
    const application = await prisma.caApplication.create({
      data: {
        userId,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info("CA application created", {
      userId,
      applicationId: application.id,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Campus Ambassador application submitted successfully",
      data: {
        applicationId: application.id,
        status: application.status,
        appliedAt: application.createdAt,
      },
    });
  },
);

export { createCaApplication };
