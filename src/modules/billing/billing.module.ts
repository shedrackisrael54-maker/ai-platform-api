import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { StripeService } from './stripe.service';
import { UsageMeteringService } from './usage-metering.service';

@Module({
  controllers: [BillingController],
  providers: [StripeService, UsageMeteringService],
  exports: [StripeService, UsageMeteringService],
})
export class BillingModule {}
