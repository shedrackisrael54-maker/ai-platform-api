import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';

/**
 * Thin wrappers around Supabase Auth. Most sign-in/sign-up traffic
 * could go directly from the mobile client to Supabase Auth; these
 * routes exist so the server can run custom logic alongside auth
 * (e.g. provisioning a `profiles` row on signup) and so the mobile
 * client only ever talks to one backend.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() body: { email: string; password: string }) {
    return this.authService.signup(body.email, body.password);
  }

  @Public()
  @Post('signin')
  async signin(@Body() body: { email: string; password: string }) {
    return this.authService.signin(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('signout')
  async signout(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '') ?? '';
    return this.authService.signout(token);
  }
}
