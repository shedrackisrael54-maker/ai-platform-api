import { Module } from '@nestjs/common';
import { GithubService } from './github.service';

/**
 * Deliberately has no imports of other feature modules (ProjectsModule,
 * AiModule, etc.) so it can be safely imported by any of them without
 * creating a circular dependency - it only needs the globally-available
 * Supabase client and ConfigService.
 */
@Module({
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
