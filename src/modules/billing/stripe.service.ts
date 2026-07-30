import { Injectable } from '@nestjs/common';

@Injectable()
export class StripeService {
  async getPlanForUser(_userId: string) {
    throw new Error('Not implemented');
  }

  async createCheckoutSession(_userId: string, _plan: string) {
    throw new Error('Not implemented');
  }

  async createPortalSession(_userId: string) {
    throw new Error('Not implemented');
  }

  async handleWebhook(_req: any) {
    // TODO: verify signature with STRIPE_WEBHOOK_SECRET before trusting
    // the payload; update `subscriptions` table on
    // checkout.session.completed / customer.subscription.updated /
    // invoice.payment_failed.
    throw new Error('Not implemented');
  }
}
