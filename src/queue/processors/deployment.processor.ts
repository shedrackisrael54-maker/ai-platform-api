import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('deployment')
export class DeploymentProcessor extends WorkerHost {
  async process(_job: Job): Promise<any> {
    // TODO: poll Vercel deployment status until ready/error, emit
    // progress via RealtimeGateway, update `deployments` table.
    throw new Error('Not implemented');
  }
}
