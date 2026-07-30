import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('ai-generation')
export class AiGenerationProcessor extends WorkerHost {
  async process(_job: Job): Promise<any> {
    // TODO: call AiOrchestratorService, apply validated file ops via
    // SandboxService, sync results via FileSyncService, stream
    // progress/build logs via RealtimeGateway. On build failure,
    // feed the error back into a bounded auto-retry loop.
    throw new Error('Not implemented');
  }
}
