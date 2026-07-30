import { Injectable } from '@nestjs/common';

/**
 * All GitHub API interaction (via a GitHub App with repo-scoped
 * permissions, never a broad personal access token). Owns repo
 * creation-per-project and commit/push operations used by
 * FileSyncService.
 */
@Injectable()
export class GithubService {
  async createRepoForProject(_projectId: string) {
    throw new Error('Not implemented');
  }

  async commitFiles(_projectId: string, _files: Record<string, string>, _message: string) {
    throw new Error('Not implemented');
  }

  async getLatestCommitSha(_projectId: string) {
    throw new Error('Not implemented');
  }
}
