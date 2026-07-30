import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('sandbox-boot')
export class SandboxBootProcessor extends WorkerHost {
  async process(_job: Job): Promise<any> {
    // TODO: provision sandbox via SandboxService, clone repo, install
    // deps, start dev server, emit progress via RealtimeGateway.
    throw new Error('Not implemented');
  }
}
