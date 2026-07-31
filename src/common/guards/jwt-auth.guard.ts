import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Validates the Supabase-issued JWT on every request.
 *
 * Supabase projects can sign access tokens one of two ways:
 *  - Legacy: a single shared HS256 secret (what SUPABASE_JWT_SECRET
 *    is for).
 *  - Current default: asymmetric signing keys, verified against a
 *    public JWKS endpoint (no shared secret needed or possible).
 *
 * A project can be on either system depending on when it was
 * created, and there's no reliable way to know which from the
 * client side alone. So this guard tries JWKS verification first
 * (the modern, more common case) and falls back to the shared-secret
 * check only if that fails - covering both without needing to know
 * in advance which one a given Supabase project uses.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private getJwks() {
    if (!this.jwks) {
      const supabaseUrl = this.config.get<string>('supabase.url');
      const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);

    // Try modern JWKS-based (asymmetric) verification first.
    try {
      const { payload } = await jwtVerify(token, this.getJwks());
      request.user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      } satisfies AuthenticatedUser;
      return true;
    } catch {
      // Fall through to legacy shared-secret verification below.
    }

    // Fallback: legacy HS256 shared-secret verification.
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = {
        id: payload.sub,
        email: payload.email,
      } satisfies AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
