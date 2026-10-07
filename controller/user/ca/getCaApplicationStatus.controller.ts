import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/auth.types.helper.js";

/**
 * GET /user/ca/status
 * Get the current user's CA application status
 */
const getCaApplicationStatus = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    _next: NextFunction,
  ) => {
    const { id: userId } = req.user;

    const application = await prisma.caApplication.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: application ? "Application found" : "No application found",
      data: application
        ? {
            hasApplied: true,
            applicationId: application.id,
            status: application.status,
            appliedAt: application.createdAt,
            updatedAt: application.updatedAt,
          }
        : {
            hasApplied: false,
          },
    });
  },
);

export { getCaApplicationStatus };
