import { Inject, Injectable } from '@nestjs/common';
import type { ISandboxProvider } from './providers/sandbox-provider.interface';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class SandboxService {
  constructor(
    @Inject('ISandboxProvider') private readonly provider: ISandboxProvider,
    private readonly projectsService: ProjectsService,
  ) {}

  // This service is the ONLY place in the app that talks to the
  // sandbox provider. Everything else goes through here, so swapping
  // E2B for self-hosted infra later means changing the provider
  // binding in sandbox.module.ts and nothing else.

  async start(userId: string, projectId: string) {
    // Throws NotFound/Forbidden if the user doesn't own this project.
    await this.projectsService.getById(userId, projectId);
    return this.provider.createSandbox(projectId);
  }

  async stop(userId: string, projectId: string) {
    await this.projectsService.getById(userId, projectId);
    await this.provider.destroySandbox(projectId);
    return { success: true };
  }

  async getStatus(userId: string, projectId: string) {
    await this.projectsService.getById(userId, projectId);
    return this.provider.getStatus(projectId);
  }

  async exec(userId: string, projectId: string, command: string) {
    await this.projectsService.getById(userId, projectId);
    return this.provider.exec(projectId, command);
  }
}
