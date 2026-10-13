/**
 * Payment gRPC Client
 *
 * Typed client for communicating with Go payment service.
 * Uses generated types from proto/payment/v1/payment.proto
 */

import * as grpc from "@grpc/grpc-js";
import { readFileSync } from "fs";
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
 * Create metadata with auth token
 */
function createAuthMetadata(): grpc.Metadata {
  const metadata = new grpc.Metadata();
  metadata.set("authorization", `Bearer ${env.PAYMENT_SERVICE_TOKEN}`);
  return metadata;
}

/**
 * Promisify a gRPC callback-based method with auth
 */
function promisify<TRequest, TResponse>(
  client: PaymentServiceClient,
  method: (
    request: TRequest,
    metadata: grpc.Metadata,
    callback: (error: grpc.ServiceError | null, response: TResponse) => void,
  ) => grpc.ClientUnaryCall,
  request: TRequest,
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    method.call(client, request, createAuthMetadata(), (error, response) => {
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
  private address: string;

  private constructor() {
    const host = env.PAYMENT_GRPC_HOST || "localhost";
    const port = env.PAYMENT_GRPC_PORT || "50051";
    this.address = `${host}:${port}`;

    this.client = this.createClient();
    console.log(`[gRPC] PaymentServiceClient connected to ${this.address}`);
  }

  private createClient(): PaymentServiceClient {
    // The Go payment service serves gRPC over TLS (see KY27_backend_go
    // cmd/server.go — grpc.Creds from certs/server.crt). When a CA/server cert
    // path is configured we build a TLS channel trusting that cert; otherwise
    // we fall back to an insecure channel (local dev with a plaintext server).
    let credentials: grpc.ChannelCredentials;
    const caCertPath = env.PAYMENT_GRPC_CA_CERT;

    if (caCertPath) {
      try {
        const rootCert = readFileSync(caCertPath);
        credentials = grpc.credentials.createSsl(rootCert);
        console.log(`[gRPC] Using TLS (root cert: ${caCertPath})`);
      } catch (err) {
        console.error(
          `[gRPC] Failed to read TLS cert at ${caCertPath}, falling back to insecure:`,
          (err as Error).message,
        );
        credentials = grpc.credentials.createInsecure();
      }
    } else {
      credentials = grpc.credentials.createInsecure();
    }

    return new PaymentServiceClient(this.address, credentials, {
      "grpc.keepalive_time_ms": 10000,
      "grpc.keepalive_timeout_ms": 5000,
      "grpc.keepalive_permit_without_calls": 1,
      "grpc.max_receive_message_length": 4 * 1024 * 1024,
      "grpc.max_send_message_length": 4 * 1024 * 1024,
    });
  }

  /**
   * Reconnect the client (for recovering from connection failures)
   */
  private reconnect(): void {
    console.log(`[gRPC] Reconnecting to ${this.address}...`);
    this.client.close();
    this.client = this.createClient();
  }

  public static getInstance(): PaymentClient {
    if (!PaymentClient.instance) {
      PaymentClient.instance = new PaymentClient();
    }
    return PaymentClient.instance;
  }

  /**
   * Reset the singleton instance (forces reconnection on next getInstance)
   */
  public static resetInstance(): void {
    if (PaymentClient.instance) {
      PaymentClient.instance.client.close();
      PaymentClient.instance = null as unknown as PaymentClient;
      console.log("[gRPC] PaymentClient instance reset");
    }
  }

  /**
   * Create a payment order (with automatic retry on connection failure)
   */
  async createPayment(
    request: CreatePaymentRequest,
  ): Promise<CreatePaymentResponse> {
    try {
      return await promisify(this.client, this.client.createPayment, request);
    } catch (error) {
      // If connection failed, try reconnecting once
      if (error instanceof Error && error.message.includes("UNAVAILABLE")) {
        console.log("[gRPC] Connection failed, attempting reconnect...");
        this.reconnect();
        return promisify(this.client, this.client.createPayment, request);
      }
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    request: GetPaymentStatusRequest,
  ): Promise<GetPaymentStatusResponse> {
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
          console.error(
            "[gRPC] PaymentService health check failed:",
            error.message,
          );
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

// Export for resetting connection
export const resetPaymentClient = () => PaymentClient.resetInstance();

// Export for graceful shutdown
export const closePaymentClient = () => {
  PaymentClient.getInstance().close();
};
