import type { Response } from "express";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { queuePassesInvoiceEmail } from "@services/queue/emailQueue.service.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// CREATE COMPLIMENTARY PASS (Admin)
// Admin grants a free pass to a user with custom benefits
// ═══════════════════════════════════════════════════════════════════

interface PassBenefitsInput {
  festivalEntry?: boolean;
  allDaysAccess?: boolean;
  proNiteAccess?: boolean;
  proNiteSeating?: "none" | "general" | "priority" | "vip";
  welcomeKit?: boolean;
  tshirt?: boolean;
  merchandise?: boolean;
  mealsIncluded?: number;
  refreshments?: boolean;
  backstageAccess?: boolean;
  workshopAccess?: boolean;
  meetAndGreet?: boolean;
  accommodationIncluded?: boolean;
  accommodationType?: string;
  custom?: Array<{
    name: string;
    description?: string;
    value?: unknown;
  }>;
}

interface CreateComplimentaryPassBody {
  userId: string;           // Our user ID
  passType: string;         // e.g., "VIP Complimentary", "Sponsor Pass"
  benefits: PassBenefitsInput;
  reason: string;           // Why the pass is being given
}

export const createComplimentaryPass = async (
  req: AdminRequestWithVerifiedCreds & { body: CreateComplimentaryPassBody },
  res: Response
) => {
  const { userId, passType, benefits, reason } = req.body;
  const adminId = req.admin?.adminId;

  if (!adminId) {
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      statusCode: 400,
      message: "Reason for complimentary pass is required",
    });
  }

  try {
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
      return res.status(404).json({
        statusCode: 404,
        message: "User not found",
      });
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

    res.status(201).json({
      statusCode: 201,
      message: "Complimentary pass created successfully",
      data: { purchase },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to create complimentary pass",
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to create complimentary pass",
    });
  }
};
