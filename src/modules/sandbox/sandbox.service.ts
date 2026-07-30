import { Inject, Injectable } from '@nestjs/common';
import type { ISandboxProvider } from './providers/sandbox-provider.interface';

@Injectable()
export class SandboxService {
  constructor(
    @Inject('ISandboxProvider') private readonly provider: ISandboxProvider,
  ) {}

  // This service is the ONLY place in the app that talks to the
  // sandbox provider. Everything else goes through here, so swapping
  // E2B for self-hosted infra later means changing the provider
  // binding in sandbox.module.ts and nothing else.

  async start(_userId: string, projectId: string) {
    return this.provider.createSandbox(projectId);
  }

  async stop(_userId: string, projectId: string) {
    return this.provider.destroySandbox(projectId);
  }

  async getStatus(_userId: string, projectId: string) {
    return this.provider.getStatus(projectId);
  }

  async exec(_userId: string, projectId: string, command: string) {
    return this.provider.exec(projectId, command);
  }
}
