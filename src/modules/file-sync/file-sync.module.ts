import { Module } from '@nestjs/common';
import { FileSyncController } from './file-sync.controller';
import { FileSyncService } from './file-sync.service';

@Module({
  controllers: [FileSyncController],
  providers: [FileSyncService],
  exports: [FileSyncService],
})
export class FileSyncModule {}
