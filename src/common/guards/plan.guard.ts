import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Checks the requesting user's cached subscription/plan (from the
 * `subscriptions` table, kept in sync via Stripe webhooks) against
 * whatever limit the decorated route requires. Never calls Stripe
 * synchronously on the request path.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    // TODO: look up subscription row for request.user.id, compare
    // against route's required plan/quota, throw ForbiddenException
    // if exceeded.
    return true;
  }
}
