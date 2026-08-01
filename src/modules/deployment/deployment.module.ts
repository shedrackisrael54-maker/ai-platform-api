import { Module } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { VercelService } from './vercel.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [DeploymentController],
  providers: [VercelService],
  exports: [VercelService],
})
export class DeploymentModule {}
