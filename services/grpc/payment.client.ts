/**
 * Payment gRPC Client
 * 
 * Typed client for communicating with Go payment service.
 * Uses generated types from proto/payment/v1/payment.proto
 */

import * as grpc from "@grpc/grpc-js";
import { env } from "@lib/env/environment.js";
import {
  PaymentServiceClient,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type GetPaymentStatusRequest,
  type GetPaymentStatusResponse,
  type Buyer,
  PaymentStatus,
} from "@root/gen/payment/v1/payment.js";

// Re-export types for consumers
export {
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type GetPaymentStatusRequest,
  type GetPaymentStatusResponse,
  type Buyer,
  PaymentStatus,
};

/**
 * Promisify a gRPC callback-based method
 */
function promisify<TRequest, TResponse>(
  client: PaymentServiceClient,
  method: (
    request: TRequest,
    callback: (error: grpc.ServiceError | null, response: TResponse) => void
  ) => grpc.ClientUnaryCall,
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    method.call(client, request, (error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Payment Client Singleton
 */
class PaymentClient {
  private client: PaymentServiceClient;
  private static instance: PaymentClient;

  private constructor() {
    const host = env.PAYMENT_GRPC_HOST || "localhost";
    const port = env.PAYMENT_GRPC_PORT || "50051";
    const address = `${host}:${port}`;

    // TODO: Use TLS in production
    const credentials = grpc.credentials.createInsecure();

    this.client = new PaymentServiceClient(address, credentials, {
      "grpc.keepalive_time_ms": 10000,
      "grpc.keepalive_timeout_ms": 5000,
      "grpc.keepalive_permit_without_calls": 1,
      "grpc.max_receive_message_length": 4 * 1024 * 1024,
      "grpc.max_send_message_length": 4 * 1024 * 1024,
    });

    console.log(`[gRPC] PaymentServiceClient connected to ${address}`);
  }

  public static getInstance(): PaymentClient {
    if (!PaymentClient.instance) {
      PaymentClient.instance = new PaymentClient();
    }
    return PaymentClient.instance;
  }

  /**
   * Create a payment order
   */
  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return promisify(this.client, this.client.createPayment, request);
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(request: GetPaymentStatusRequest): Promise<GetPaymentStatusResponse> {
    return promisify(this.client, this.client.getPaymentStatus, request);
  }

  /**
   * Health check - wait for client to be ready
   */
  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.waitForReady(deadline, (error) => {
        if (error) {
          console.error("[gRPC] PaymentService health check failed:", error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Close the client connection
   */
  close(): void {
    this.client.close();
    console.log("[gRPC] PaymentServiceClient closed");
  }
}

// Export singleton getter
export const getPaymentClient = () => PaymentClient.getInstance();

// Export for graceful shutdown
export const closePaymentClient = () => {
  PaymentClient.getInstance().close();
};
