import { Injectable } from '@nestjs/common';

/**
 * Reconciles three representations of project state that must never
 * silently diverge: the live sandbox filesystem, the GitHub repo, and
 * the version metadata in Postgres. Both AI-driven edits and manual
 * user edits flow through this service.
 */
@Injectable()
export class FileSyncService {
  async getTree(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }

  async readFile(_userId: string, _projectId: string, _path: string) {
    throw new Error('Not implemented');
  }

  async writeFile(
    _userId: string,
    _projectId: string,
    _path: string,
    _content: string,
  ) {
    // TODO: write to sandbox (if running), commit to GitHub, update
    // project_versions.
    throw new Error('Not implemented');
  }

  async createEntry(
    _userId: string,
    _projectId: string,
    _path: string,
    _isDirectory: boolean,
  ) {
    throw new Error('Not implemented');
  }

  async deleteFile(_userId: string, _projectId: string, _path: string) {
    throw new Error('Not implemented');
  }
}
