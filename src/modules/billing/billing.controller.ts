import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { StripeService } from './stripe.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('plan')
  getPlan(@Req() req: any) {
    return this.stripeService.getPlanForUser(req.user.id);
  }

  @Post('checkout-session')
  createCheckoutSession(@Req() req: any, @Body() body: { plan: string }) {
    return this.stripeService.createCheckoutSession(req.user.id, body.plan);
  }

  @Post('portal-session')
  createPortalSession(@Req() req: any) {
    return this.stripeService.createPortalSession(req.user.id);
  }

  // Stripe calls this directly - not user-authenticated. Signature
  // verified inside StripeService using the raw request body.
  @Public()
  @Post('webhook')
  handleWebhook(@Req() req: any) {
    return this.stripeService.handleWebhook(req);
  }
}
