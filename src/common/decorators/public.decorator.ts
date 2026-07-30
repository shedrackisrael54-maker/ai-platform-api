import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as not requiring authentication.
 * Use sparingly: webhooks, health checks only.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
