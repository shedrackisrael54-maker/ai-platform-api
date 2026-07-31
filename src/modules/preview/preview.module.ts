import { Module } from '@nestjs/common';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';
import { ProjectsModule } from '../projects/projects.module';
import { SandboxModule } from '../sandbox/sandbox.module';

@Module({
  imports: [ProjectsModule, SandboxModule],
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
