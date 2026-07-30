import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN_CLIENT = 'SUPABASE_ADMIN_CLIENT';
export const SUPABASE_ANON_CLIENT = 'SUPABASE_ANON_CLIENT';

/**
 * Global module exposing two Supabase clients:
 *
 * - SUPABASE_ANON_CLIENT: used for anything that should go through
 *   Supabase Auth's normal rules (signUp, signInWithPassword,
 *   refreshSession). Uses the anon key.
 *
 * - SUPABASE_ADMIN_CLIENT: used by backend services (ProjectsService,
 *   etc.) that already know the authenticated user's id (from the
 *   verified JWT) and enforce ownership checks themselves. Uses the
 *   service-role key, which bypasses RLS - so every query built on
 *   top of this client MUST filter by owner_id explicitly. RLS
 *   remains in place as a second layer of defense for any path that
 *   talks to Supabase directly (e.g. future direct-from-mobile
 *   Realtime subscriptions).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        return createClient(
          config.get<string>('supabase.url')!,
          config.get<string>('supabase.serviceRoleKey')!,
          { auth: { persistSession: false } },
        );
      },
    },
    {
      provide: SUPABASE_ANON_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseClient => {
        return createClient(
          config.get<string>('supabase.url')!,
          config.get<string>('supabase.anonKey')!,
          { auth: { persistSession: false } },
        );
      },
    },
  ],
  exports: [SUPABASE_ADMIN_CLIENT, SUPABASE_ANON_CLIENT],
})
export class SupabaseModule {}
