import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { SandboxService } from '../sandbox/sandbox.service';

/**
 * Milestone 3/early-4 scope: returns the E2B-exposed URL directly.
 * A platform-owned signed URL (so we can swap sandbox providers or
 * add expiry without breaking shared links) is a Milestone 4
 * hardening step once there's real usage to justify it - this
 * unblocks actually seeing a running project in the meantime.
 */
@Injectable()
export class PreviewService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly sandboxService: SandboxService,
  ) {}

  async getSignedUrl(userId: string, projectId: string) {
    await this.projectsService.getById(userId, projectId);
    const status = await this.sandboxService.getStatus(userId, projectId);
    if (status.state !== 'running' || !status.previewUrl) {
      return { url: null, ready: false, sandboxState: status.state };
    }
    return { url: status.previewUrl, ready: true, sandboxState: status.state };
  }

  async refresh(userId: string, projectId: string) {
    // Starting the sandbox is idempotent - reuses an existing running
    // one if present (see E2bProvider.createSandbox).
    const status = await this.sandboxService.start(userId, projectId);
    return { url: status.previewUrl ?? null, ready: status.state === 'running' };
  }
}
