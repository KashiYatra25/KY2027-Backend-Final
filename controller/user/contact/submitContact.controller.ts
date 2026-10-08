import type { Request, Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import type { ContactSchemaType } from "@root/controller/middleware/schemas/user/contact.schema.js";

/**
 * POST /contact
 * Handle contact form submissions (public endpoint - no auth required)
 */
const submitContact = catchAsync(
  async (
    req: VerifiedRequest<{ body: ContactSchemaType }, Request>,
    res: Response,
    _next: NextFunction,
  ) => {
    const { name, email } = req.validatedData;

    // TODO: Implement actual contact handling:
    // - Send email notification to admin
    // - Store in database for tracking
    // - Integrate with ticketing system (if any)

    console.log(`[Contact] New submission from ${name} <${email}>`);

    new OkResponseStrategy().handleResponse(res, {
      info: "Message sent successfully",
      data: {
        success: true,
      },
    });
  },
);

export { submitContact };
