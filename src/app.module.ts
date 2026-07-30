import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import configuration from './config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SupabaseModule } from './supabase/supabase.module';

import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AiModule } from './modules/ai/ai.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { FileSyncModule } from './modules/file-sync/file-sync.module';
import { PreviewModule } from './modules/preview/preview.module';
import { DeploymentModule } from './modules/deployment/deployment.module';
import { BillingModule } from './modules/billing/billing.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('supabase.jwtSecret'),
      }),
    }),
    SupabaseModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    AiModule,
    SandboxModule,
    FileSyncModule,
    PreviewModule,
    DeploymentModule,
    BillingModule,
    RealtimeModule,
  ],
  providers: [
    // Global auth guard: every route requires a valid Supabase JWT
    // unless explicitly marked with the @Public() decorator.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
