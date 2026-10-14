import { Email } from '@email/base.js';
import { type IUser } from '@email/types/email.types.js';

export interface PaymentFailedData {
  orderId: string;
  totalAmount: number;
  items: Array<{
    passName: string;
    quantity: number;
  }>;
  status: 'FAILED' | 'EXPIRED' | 'TIMEOUT';
  cartUrl: string;
}

export class PaymentFailedEmail extends Email {
  private paymentData: PaymentFailedData;

  constructor(user: IUser, paymentData: PaymentFailedData) {
    super(user);
    this.paymentData = paymentData;
  }

  override async sendEmail(subject: string, template: string): Promise<void> {
    await this.sendWithTemplate(subject, template, {
      userName: this.firstName,
      orderId: this.paymentData.orderId,
      totalAmount: this.paymentData.totalAmount,
      items: this.paymentData.items,
      status: this.paymentData.status,
      isExpired: this.paymentData.status === 'EXPIRED',
      isTimeout: this.paymentData.status === 'TIMEOUT',
      cartUrl: this.paymentData.cartUrl,
    });
  }
}
