import type { NextFunction, Request, Response } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";

/**
 * GET /events/:slug
 * Get single event details by slug
 */
const getEventBySlug = catchAsync(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const slug = req.params.slug as string;

    const event = await prisma.event.findUnique({
      where: { slug },
    });

    if (!event) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Event not found",
        }),
      );
    }

    new OkResponseStrategy().handleResponse(res, {
      info: "Event fetched successfully",
      event,
    });
  },
);

export { getEventBySlug };
