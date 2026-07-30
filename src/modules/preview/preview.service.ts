import { Injectable } from '@nestjs/common';

/**
 * Wraps the raw E2B-exposed dev-server URL behind a platform-owned,
 * signed, short-lived URL. This is what makes the sandbox provider
 * swappable without breaking preview links the user may have shared,
 * and lets us serve previews from a distinct subdomain (never the
 * platform's main origin) to contain any XSS in generated apps.
 */
@Injectable()
export class PreviewService {
  async getSignedUrl(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }

  async refresh(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }
}
