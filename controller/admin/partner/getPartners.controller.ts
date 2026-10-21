import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

/**
 * GET /admin/partners
 * List all partnership inquiries (from the "Partner With Us" form).
 * Requires: MASTER_ADMIN or MANAGER role.
 */
export const getPartners = catchAsync(
  async (
    _req: AdminRequestWithVerifiedCreds,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const partners = await prisma.partner.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Partner inquiries fetched successfully",
      partners,
      count: partners.length,
    });
  },
);
