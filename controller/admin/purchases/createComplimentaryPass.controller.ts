import type { Response, NextFunction } from "express";
import { catchAsync, type VerifiedRequest } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { BadRequest, NotFound } from "zodex-axon/errors";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { queuePassesInvoiceEmail } from "@services/queue/emailQueue.service.js";
import { logger } from "@logger/logger.js";
import { invalidateProfileCache } from "@root/services/redis/entityCache.service.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";
import type { CreateComplimentaryPassBody } from "@controller/admin/helper/types/purchases.types.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE COMPLIMENTARY PASS (Admin)
// Admin grants a free pass to a user with custom benefits
// ═══════════════════════════════════════════════════════════════════

export const createComplimentaryPass = catchAsync(
  async (
    req: VerifiedRequest<{ body: CreateComplimentaryPassBody }, AdminRequestWithVerifiedCreds>,
    res: Response,
    next: NextFunction,
  ) => {
    const { userId, passType, benefits, reason } = req.validatedData;
    const adminId = req.admin?.adminId;

    if (!adminId) {
      return next(new BadRequest().handleResponse(res, { info: "Unauthorized" }));
    }

    if (!reason || reason.trim().length === 0) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Reason for complimentary pass is required",
        }),
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        kyId: true,
        college: true,
      },
    });

    if (!user) {
      return next(new NotFound().handleResponse(res, { info: "User not found" }));
    }

    // Create the complimentary purchase
    const purchase = await PurchaseModel.create({
      userId: user.id,
      source: "complimentary",
      passType,
      amountPaid: 0,
      currency: "INR",
      benefits,
      status: "VERIFIED",
      complimentary: {
        reason: reason.trim(),
        approvedBy: adminId,
        approvedAt: new Date(),
      },
      userSnapshot: {
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        phone: user.phone || null,
        kyId: user.kyId || null,
        college: user.college || null,
      },
    });

    // Mark user as paid
    await prisma.user.update({
      where: { id: user.id },
      data: { isPaidUser: true },
    });

    await invalidateProfileCache(user.id);

    // Queue confirmation email
    await queuePassesInvoiceEmail({
      userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User",
      email: user.email,
      invoiceUrl: "",
      orderDetails: {
        passType,
        amountPaid: 0,
        isComplimentary: true,
        grantedAt: new Date().toISOString(),
      },
    });

    logger.info({
      msg: "Complimentary pass created",
      purchaseId: purchase._id,
      userId: user.id,
      passType,
      reason,
      approvedBy: adminId,
    });

    new OkResponseStrategy().handleResponse(res, {
      info: "Complimentary pass created successfully",
      purchase,
    });
  },
);
