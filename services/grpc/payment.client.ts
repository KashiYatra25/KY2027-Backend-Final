import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "@root/lib/env/environment";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Proto file path - shared proto directory
const PROTO_PATH = path.resolve(__dirname, "../../../../proto/payment/v1/payment.proto");

// Load proto file
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const paymentProto = protoDescriptor.payment.v1;

// Type definitions based on proto
export interface OrderItem {
  pass_type: "PASS_TYPE_GENERAL" | "PASS_TYPE_PRO" | "PASS_TYPE_VIP" | "PASS_TYPE_COMBO";
  quantity: number;
  unit_price_paise: string;
}

export interface CreateOrderRequest {
  user_id: string;
  user_email: string;
  user_phone: string;
  items: OrderItem[];
  idempotency_key: string;
}

export interface CreateOrderResponse {
  order_id: string;
  razorpay_order_id: string;
  amount_paise: string;
  currency: string;
  razorpay_key_id: string;
  created_at: string;
}

export interface VerifyPaymentRequest {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  payment_id: string;
  status: string;
  message: string;
  verified_at: string;
}

export interface GetPaymentStatusRequest {
  order_id: string;
}

export interface GetPaymentStatusResponse {
  order_id: string;
  payment_id: string;
  status: string;
  amount_paise: string;
  method: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessRefundRequest {
  payment_id: string;
  amount_paise: string;
  reason: string;
  initiated_by: string;
}

export interface ProcessRefundResponse {
  success: boolean;
  refund_id: string;
  refunded_amount_paise: string;
  new_status: string;
  message: string;
}

export interface GetUserPaymentsRequest {
  user_id: string;
  page: number;
  page_size: number;
  status_filter?: string;
}

export interface Payment {
  payment_id: string;
  order_id: string;
  amount_paise: string;
  status: string;
  method: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface GetUserPaymentsResponse {
  payments: Payment[];
  total_count: number;
  page: number;
  page_size: number;
}

// gRPC Client singleton
class PaymentGrpcClient {
  private client: any;
  private static instance: PaymentGrpcClient;

  private constructor() {
    const grpcHost = env.PAYMENT_GRPC_HOST || "localhost";
    const grpcPort = env.PAYMENT_GRPC_PORT || "50051";
    const address = `${grpcHost}:${grpcPort}`;

    // Use insecure credentials for development
    // TODO: Use SSL/TLS in production
    this.client = new paymentProto.PaymentService(
      address,
      grpc.credentials.createInsecure(),
      {
        "grpc.keepalive_time_ms": 10000,
        "grpc.keepalive_timeout_ms": 5000,
        "grpc.keepalive_permit_without_calls": 1,
        "grpc.max_receive_message_length": 4 * 1024 * 1024, // 4MB
        "grpc.max_send_message_length": 4 * 1024 * 1024,
      }
    );

    console.log(`[gRPC] PaymentService client connected to ${address}`);
  }

  public static getInstance(): PaymentGrpcClient {
    if (!PaymentGrpcClient.instance) {
      PaymentGrpcClient.instance = new PaymentGrpcClient();
    }
    return PaymentGrpcClient.instance;
  }

  // Promisify gRPC calls
  private promisify<TRequest, TResponse>(
    method: (request: TRequest, callback: (error: grpc.ServiceError | null, response: TResponse) => void) => void,
    request: TRequest
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      method.call(this.client, request, (error: grpc.ServiceError | null, response: TResponse) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // API Methods
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.promisify<CreateOrderRequest, CreateOrderResponse>(
      this.client.CreateOrder,
      request
    );
  }

  async verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    return this.promisify<VerifyPaymentRequest, VerifyPaymentResponse>(
      this.client.VerifyPayment,
      request
    );
  }

  async getPaymentStatus(request: GetPaymentStatusRequest): Promise<GetPaymentStatusResponse> {
    return this.promisify<GetPaymentStatusRequest, GetPaymentStatusResponse>(
      this.client.GetPaymentStatus,
      request
    );
  }

  async processRefund(request: ProcessRefundRequest): Promise<ProcessRefundResponse> {
    return this.promisify<ProcessRefundRequest, ProcessRefundResponse>(
      this.client.ProcessRefund,
      request
    );
  }

  async getUserPayments(request: GetUserPaymentsRequest): Promise<GetUserPaymentsResponse> {
    return this.promisify<GetUserPaymentsRequest, GetUserPaymentsResponse>(
      this.client.GetUserPayments,
      request
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.waitForReady(deadline, (error: Error | undefined) => {
        if (error) {
          console.error("[gRPC] PaymentService health check failed:", error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Graceful shutdown
  close(): void {
    if (this.client) {
      grpc.closeClient(this.client);
      console.log("[gRPC] PaymentService client closed");
    }
  }
}

// Export singleton instance getter
export const getPaymentClient = () => PaymentGrpcClient.getInstance();

// Export for graceful shutdown
export const closePaymentClient = () => {
  PaymentGrpcClient.getInstance().close();
};
