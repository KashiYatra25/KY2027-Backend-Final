import type { Request, Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { PassModel } from "@root/databaseManagers/mongoose/index.js";

/**
 * GET /pass
 * Fetch all active passes sorted by sortOrder
 * Public endpoint - no auth required
 */
const getAllPasses = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    const passes = await PassModel.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("-__v")
      .lean();

    new OkResponseStrategy().handleResponse(res, {
      info: "Passes fetched successfully",
      passes,
      count: passes.length,
    });
  }
);

export { getAllPasses };
