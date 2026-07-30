import { Module } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';
import { VercelService } from './vercel.service';

@Module({
  controllers: [DeploymentController],
  providers: [GithubService, VercelService],
  exports: [GithubService, VercelService],
})
export class DeploymentModule {}
