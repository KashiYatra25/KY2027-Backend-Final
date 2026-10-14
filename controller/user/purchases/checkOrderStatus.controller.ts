import type { Response, NextFunction } from "express";
import { catchAsync } from "zodex-axon/core";
import { OkResponseStrategy } from "zodex-axon/responses";
import { NotFound, BadRequest } from "zodex-axon/errors";
import { env } from "@lib/env/environment.js";
import { PurchaseModel } from "@root/databaseManagers/mongoose/index.js";
import type { AuthenticatedUserRequestWithVerifiedEmail } from "@helper/types/auth.types.js";

/**
 * POST /user/purchases/:orderId/check-status
 * 
 * Manually check the payment status of a pending order with Cashfree.
 * This is used when webhook might have failed and user wants to verify status.
 */
export const checkOrderStatus = catchAsync(
  async (
    req: AuthenticatedUserRequestWithVerifiedEmail,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { id: userId } = req.user;
    const { orderId } = req.params;

    if (!orderId) {
      return next(
        new BadRequest().handleResponse(res, {
          info: "Order ID is required",
        }),
      );
    }

    // 1. Verify the order belongs to this user
    const purchase = await PurchaseModel.findOne({ orderId, userId });
    if (!purchase) {
      return next(
        new NotFound().handleResponse(res, {
          info: "Order not found",
        }),
      );
    }

    // 2. Only check if status is PENDING
    if (purchase.status !== "PENDING") {
      new OkResponseStrategy().handleResponse(res, {
        info: "Order already processed",
        orderId,
        status: purchase.status,
        alreadyProcessed: true,
      });
      return;
    }

    // 3. Call Go service to reconcile with Cashfree
    const goServiceUrl = `http://${env.PAYMENT_GRPC_HOST}:8081/orders/${orderId}/reconcile`;
    
    try {
      const response = await fetch(goServiceUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.PAYMENT_SERVICE_TOKEN}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Go reconcile failed:", response.status, errorText);
        return next(
          new BadRequest().handleResponse(res, {
            info: "Failed to check payment status. Please try again.",
          }),
        );
      }

      const result = await response.json() as { order_id: string; status: string };

      // 4. Re-fetch the purchase to get updated status (Go webhook job will update it)
      // Wait a moment for the River job to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedPurchase = await PurchaseModel.findOne({ orderId });
      const finalStatus = updatedPurchase?.status ?? result.status;

      new OkResponseStrategy().handleResponse(res, {
        info: finalStatus === "PAID" 
          ? "Payment confirmed! Your passes are ready." 
          : finalStatus === "PENDING"
            ? "Payment is still being processed. Please check back in a few minutes."
            : `Payment status: ${finalStatus}`,
        orderId,
        status: finalStatus,
        reconciled: true,
      });

    } catch (error) {
      console.error("Error calling Go reconcile:", error);
      return next(
        new BadRequest().handleResponse(res, {
          info: "Failed to check payment status. Please try again later.",
        }),
      );
    }
  },
);
