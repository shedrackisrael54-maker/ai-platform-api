import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule],
  controllers: [AiController],
  providers: [AiOrchestratorService],
  exports: [AiOrchestratorService],
})
export class AiModule {}
