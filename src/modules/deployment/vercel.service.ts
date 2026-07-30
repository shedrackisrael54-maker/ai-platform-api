import { Injectable } from '@nestjs/common';

/**
 * All Vercel API interaction, scoped to a team-level token (never a
 * broad account-wide credential).
 */
@Injectable()
export class VercelService {
  async deployFromLatestCommit(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }

  async listDeployments(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }

  async getStatus(_userId: string, _projectId: string, _deploymentId: string) {
    throw new Error('Not implemented');
  }
}
