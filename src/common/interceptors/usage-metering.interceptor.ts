import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Emits a usage_events row for metered actions (AI calls, sandbox
 * minutes, deployments) after the handler completes successfully.
 * Intentionally decoupled from billing enforcement (see PlanGuard) -
 * this interceptor's only job is accurate usage tracking.
 */
@Injectable()
export class UsageMeteringInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        // TODO: write to usage_events table based on route metadata
      }),
    );
  }
}
