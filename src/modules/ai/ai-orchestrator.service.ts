import { Injectable } from '@nestjs/common';

/**
 * Owns all LLM-specific logic: prompt construction, OpenAI calls,
 * parsing structured file-operation output, and handing validated
 * operations off to SandboxService. See prompt-templates/ for the
 * system prompts and function/tool schemas.
 *
 * Never calls the sandbox directly with unvalidated AI output -
 * operations are parsed into a typed shape (file-op-parser.ts) and
 * checked (path traversal, size limits, command deny-list) before
 * SandboxModule ever sees them.
 */
@Injectable()
export class AiOrchestratorService {
  async enqueueChatTurn(_userId: string, _projectId: string, _message: string) {
    // TODO: persist the user message to chat_messages, enqueue an
    // `ai-generation` BullMQ job, return { jobId }.
    throw new Error('Not implemented');
  }

  async getHistory(_userId: string, _projectId: string) {
    throw new Error('Not implemented');
  }

  async regenerate(_userId: string, _projectId: string, _messageId: string) {
    throw new Error('Not implemented');
  }
}
