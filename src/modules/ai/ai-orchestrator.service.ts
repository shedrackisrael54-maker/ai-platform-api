import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { GENERATE_PROJECT_TOOL } from './prompt-templates/generate-project-tool';
import { GENERATE_PROJECT_SYSTEM_PROMPT } from './prompt-templates/system-prompt';
import { validateGeneratedFiles } from './file-op-parser';

/**
 * Owns all LLM-specific logic: prompt construction, OpenAI calls,
 * parsing structured file-operation output, and handing validated
 * operations off to storage. Nothing outside this service should
 * construct prompts or touch the OpenAI SDK directly.
 *
 * Milestone 2 scope: single-shot generation only (prompt -> files,
 * stored directly via Supabase). Chat-based iterative editing and
 * sandbox application are Milestone 5.
 */
@Injectable()
export class AiOrchestratorService {
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {
    const apiKey = this.config.get<string>('openai.apiKey');
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generates the initial file set for a brand-new project from the
   * user's prompt, validates the model's output, and persists it to
   * the project_files table. Called synchronously from
   * ProjectsService.createFromPrompt for Milestone 2; Milestone 3+
   * will move this behind a queued job once sandbox application and
   * build-log streaming are involved.
   */
  async generateInitialProject(
    projectId: string,
    prompt: string,
  ): Promise<{ summary: string; fileCount: number }> {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured on the server',
      );
    }

    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: GENERATE_PROJECT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        tools: [GENERATE_PROJECT_TOOL],
        tool_choice: {
          type: 'function',
          function: { name: 'create_project_files' },
        },
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `OpenAI request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_project_files') {
      throw new InternalServerErrorException(
        'Model did not return the expected tool call',
      );
    }

    let parsedArgs: { summary: string; files: unknown };
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new InternalServerErrorException('Model returned malformed JSON');
    }

    // Validation boundary: everything above this line is untrusted
    // model output. Nothing below should be reached with data that
    // hasn't passed validateGeneratedFiles.
    const files = validateGeneratedFiles(parsedArgs.files);

    const rows = files.map((f) => ({
      project_id: projectId,
      path: f.path,
      content: f.content,
    }));

    const { error } = await this.supabase.from('project_files').insert(rows);
    if (error) {
      throw new InternalServerErrorException(
        `Failed to store generated files: ${error.message}`,
      );
    }

    return { summary: parsedArgs.summary, fileCount: files.length };
  }

  // --- Milestone 5 (chat-based iterative editing) - not yet implemented ---

  async enqueueChatTurn(_userId: string, _projectId: string, _message: string) {
    throw new InternalServerErrorException(
      'Chat-based editing is not implemented yet (Milestone 5)',
    );
  }

  async getHistory(_userId: string, _projectId: string) {
    throw new InternalServerErrorException(
      'Chat history is not implemented yet (Milestone 5)',
    );
  }

  async regenerate(_userId: string, _projectId: string, _messageId: string) {
    throw new InternalServerErrorException(
      'Chat regeneration is not implemented yet (Milestone 5)',
    );
  }
}
