import { Module } from '@nestjs/common';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { DaytonaProvider } from './providers/daytona.provider';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [SandboxController],
  providers: [
    SandboxService,
    // Sandbox provider is swappable behind ISandboxProvider - see
    // sandbox-provider.interface.ts. Currently bound to Daytona;
    // E2bProvider (providers/e2b.provider.ts) implements the same
    // interface and can be swapped in here if needed later.
    { provide: 'ISandboxProvider', useClass: DaytonaProvider },
  ],
  exports: [SandboxService],
})
export class SandboxModule {}
