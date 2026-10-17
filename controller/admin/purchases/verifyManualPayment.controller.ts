import type { Response } from "express";
import { prisma } from "@root/prisma.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import { queuePassesInvoiceEmail } from "@services/queue/emailQueue.service.js";
import { logger } from "@logger/logger.js";
import type { AdminRequestWithVerifiedCreds } from "@controller/admin/helper/types/jwt.types.js";

// ═══════════════════════════════════════════════════════════════════
// VERIFY MANUAL PAYMENT (Admin)
// Admin verifies a pending manual payment and sets custom benefits
// ═══════════════════════════════════════════════════════════════════

interface PassBenefitsInput {
  // Core access
  festivalEntry?: boolean;
  allDaysAccess?: boolean;
  
  // Pro-nite access
  proNiteAccess?: boolean;
  proNiteSeating?: "none" | "general" | "priority" | "vip";
  
  // Merchandise & goodies
  welcomeKit?: boolean;
  tshirt?: boolean;
  merchandise?: boolean;
  
  // Food & hospitality
  mealsIncluded?: number;
  refreshments?: boolean;
  
  // Special access
  backstageAccess?: boolean;
  workshopAccess?: boolean;
  meetAndGreet?: boolean;
  
  // Accommodation
  accommodationIncluded?: boolean;
  accommodationType?: string;
  
  // Custom benefits
  custom?: Array<{
    name: string;
    description?: string;
    value?: unknown;
  }>;
}

interface VerifyPaymentBody {
  purchaseId: string;
  passType: string;
  amountPaid: number;
  benefits: PassBenefitsInput;
  verificationNote?: string;
}

export const verifyManualPayment = async (
  req: AdminRequestWithVerifiedCreds & { body: VerifyPaymentBody },
  res: Response
) => {
  const { purchaseId, passType, amountPaid, benefits, verificationNote } = req.body;
  const adminId = req.admin?.adminId;

  if (!adminId) {
    return res.status(401).json({
      statusCode: 401,
      message: "Unauthorized",
    });
  }

  try {
    // Find the purchase
    const purchase = await PurchaseModel.findById(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        statusCode: 404,
        message: "Purchase not found",
      });
    }

    if (purchase.status !== "PENDING_VERIFICATION") {
      return res.status(400).json({
        statusCode: 400,
        message: `Cannot verify purchase with status: ${purchase.status}`,
      });
    }

    // Update purchase with verified status and custom benefits
    purchase.status = "VERIFIED";
    purchase.passType = passType;
    purchase.amountPaid = amountPaid;
    purchase.benefits = benefits;
    purchase.manualVerification = {
      ...purchase.manualVerification,
      verifiedBy: adminId,
      verifiedAt: new Date(),
      verificationNote: verificationNote || undefined,
    };

    await purchase.save();

    // Mark user as paid (if matched to a user)
    if (purchase.userId && purchase.userId !== "UNMATCHED") {
      await prisma.user.update({
        where: { id: purchase.userId },
        data: { isPaidUser: true },
      });

      // Queue confirmation email
      if (purchase.userSnapshot?.email) {
        await queuePassesInvoiceEmail({
          userName: purchase.userSnapshot.name || "User",
          email: purchase.userSnapshot.email,
          invoiceUrl: "",
          orderDetails: {
            passType,
            amountPaid,
            verifiedAt: new Date().toISOString(),
            verifiedBy: adminId,
          },
        });
      }
    }

    logger.info({
      msg: "Manual payment verified",
      purchaseId,
      userId: purchase.userId,
      passType,
      amountPaid,
      verifiedBy: adminId,
    });

    res.status(200).json({
      statusCode: 200,
      message: "Payment verified successfully",
      data: { purchase },
    });
  } catch (error) {
    logger.error({
      msg: "Failed to verify payment",
      purchaseId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      statusCode: 500,
      message: "Failed to verify payment",
    });
  }
};
