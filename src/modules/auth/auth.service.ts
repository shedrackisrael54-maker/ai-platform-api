import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_ANON_CLIENT,
} from '../../supabase/supabase.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_ANON_CLIENT) private readonly supabaseAuth: SupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async signup(email: string, password: string) {
    const { data, error } = await this.supabaseAuth.auth.signUp({
      email,
      password,
    });
    if (error) throw new UnauthorizedException(error.message);

    // Provision the profile row on first signup. Uses the admin
    // client since RLS on `profiles` restricts inserts to the owning
    // user, and at this point we're acting on the server's behalf
    // right after account creation.
    if (data.user) {
      await this.supabaseAdmin.from('profiles').upsert({
        id: data.user.id,
        display_name: email.split('@')[0],
      });
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async signin(email: string, password: string) {
    const { data, error } = await this.supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new UnauthorizedException(error.message);

    return {
      user: data.user,
      session: data.session,
    };
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error) throw new UnauthorizedException(error.message);

    return { session: data.session };
  }

  async signout(accessToken: string) {
    // auth.admin.* methods require the service-role client.
    const { error } = await this.supabaseAdmin.auth.admin.signOut(accessToken);
    if (error) throw new UnauthorizedException(error.message);
    return { success: true };
  }
}
