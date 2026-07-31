import { Module } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { GithubService } from './github.service';
import { VercelService } from './vercel.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [DeploymentController],
  // GithubService stays registered but unused by the controller for
  // now - real Git-backed deployments are Milestone 7. VercelService
  // uses Vercel's direct-upload API in the meantime.
  providers: [GithubService, VercelService],
  exports: [GithubService, VercelService],
})
export class DeploymentModule {}
