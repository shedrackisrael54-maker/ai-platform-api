import { Module } from '@nestjs/common';
import { FileSyncController } from './file-sync.controller';
import { FileSyncService } from './file-sync.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [FileSyncController],
  providers: [FileSyncService],
  exports: [FileSyncService],
})
export class FileSyncModule {}
