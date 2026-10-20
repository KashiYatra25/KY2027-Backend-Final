import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { prisma } from "@root/prisma.js";
import { logger } from "@logger/logger.js";
import type { BecomePartnerRequestSchemaType } from "@schemas/user/partner.schema.js";

/**
 * POST /user/become-partner
 * Public endpoint — stores a sponsorship/partnership inquiry submitted from
 * the sponsors page "Partner With Us" form. No auth required.
 */
const becomePartner = catchAsync(
  async (
    req: VerifiedRequest<{ body: BecomePartnerRequestSchemaType }>,
    res: Response,
    _next: NextFunction,
  ) => {
    const { name, email } = req.validatedData;

    const partner = await prisma.partner.create({
      data: { name, email },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    logger.info("New partnership inquiry", { partnerId: partner.id, email: partner.email });

    new OkResponseStrategy().handleResponse(res, {
      info: "Thanks for reaching out! Our team will get back to you soon.",
      success: true,
    });
  },
);

export { becomePartner };
