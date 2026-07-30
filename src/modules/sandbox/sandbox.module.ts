import { Module } from '@nestjs/common';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { E2bProvider } from './providers/e2b.provider';

@Module({
  controllers: [SandboxController],
  providers: [
    SandboxService,
    { provide: 'ISandboxProvider', useClass: E2bProvider },
  ],
  exports: [SandboxService],
})
export class SandboxModule {}
