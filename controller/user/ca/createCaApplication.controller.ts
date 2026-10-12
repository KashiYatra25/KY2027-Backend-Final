import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, ForbiddenErrorResponse } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";
import type { BecomeCaRequestSchemaType } from "@schemas/user/caApplication.schema.js";

/**
 * POST /user/ca/apply
 * Create a new CA application for the authenticated user
 * Requirements:
 * - User must be authenticated
 * - User must have USER role (enforced by roleCheckerMiddleware in routes)
 * - User must NOT be from IIT BHU (isFromIITBhu: false)
 * - User must have completed profile (enforced by checkWhetherProfileIsCompleteMiddleware)
 * - User must not have an existing application
 */
const createCaApplication = catchAsync(
  async (
    req: VerifiedRequest<
      { body: BecomeCaRequestSchemaType },
      AuthenticatedUserRequestWithVerifiedEmail
    >,
    res: Response,
    next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    // Check if user is from IIT BHU - they cannot apply for CA
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isFromIITBhu: true },
    });

    if (user?.isFromIITBhu) {
      return next(
        new ForbiddenErrorResponse().handleResponse(res, {
          info: "IIT BHU students cannot apply for Campus Ambassador",
          reason:
            "The Campus Ambassador program is designed to help spread awareness about Kashi Yatra at other colleges. As an IIT BHU student, you're already part of the organizing team!",
        }),
      );
    }

    // Check if user already has a CA application
    const existingApplication = await prisma.caApplication.findUnique({
      where: { userId },
    });

    if (existingApplication) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "You have already applied for Campus Ambassador",
          status: existingApplication.status,
          appliedAt: existingApplication.createdAt,
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
      applicationId: application.id,
      status: application.status,
      appliedAt: application.createdAt,
    });
  },
);

export { createCaApplication };
