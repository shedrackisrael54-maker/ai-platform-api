import { Injectable } from '@nestjs/common';

@Injectable()
export class UsageMeteringService {
  async recordEvent(
    _userId: string,
    _type: 'ai_tokens' | 'sandbox_minutes' | 'deployment',
    _quantity: number,
    _projectId?: string,
  ) {
    throw new Error('Not implemented');
  }

  async getSummary(_userId: string) {
    throw new Error('Not implemented');
  }
}
