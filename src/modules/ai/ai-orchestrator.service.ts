import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { GENERATE_PROJECT_TOOL } from './prompt-templates/generate-project-tool';
import { EDIT_PROJECT_TOOL } from './prompt-templates/edit-project-tool';
import {
  GENERATE_PROJECT_SYSTEM_PROMPT,
  EDIT_PROJECT_SYSTEM_PROMPT,
} from './prompt-templates/system-prompt';
import { validateGeneratedFiles, validateEditOperations } from './file-op-parser';

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

  /**
   * Applies a user's requested change to an existing project: fetches
   * current files as context, asks OpenAI what needs to change,
   * validates the response, and applies it to project_files.
   *
   * Note: if a sandbox is currently running for this project, it
   * will keep serving the pre-edit version until it's restarted
   * (createSandbox reuses a running sandbox rather than
   * re-uploading files into it). Stopping and starting the sandbox
   * again picks up the change. Live-syncing a running sandbox
   * in-place is a reasonable follow-up once this is validated.
   */
  async applyChatEdit(
    projectId: string,
    userMessage: string,
  ): Promise<{ summary: string; changedFiles: string[] }> {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured on the server',
      );
    }

    const { data: existingFiles, error: filesError } = await this.supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId);
    if (filesError) throw filesError;
    if (!existingFiles || existingFiles.length === 0) {
      throw new InternalServerErrorException(
        'Project has no files yet - generate it first',
      );
    }

    const existingPaths = new Set(existingFiles.map((f) => f.path));

    const filesContext = existingFiles
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join('\n\n');

    await this.supabase.from('chat_messages').insert({
      project_id: projectId,
      role: 'user',
      content: userMessage,
    });

    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EDIT_PROJECT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Current project files:\n\n${filesContext}\n\nRequested change: ${userMessage}`,
          },
        ],
        tools: [EDIT_PROJECT_TOOL],
        tool_choice: {
          type: 'function',
          function: { name: 'apply_project_changes' },
        },
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `OpenAI request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'apply_project_changes') {
      throw new InternalServerErrorException(
        'Model did not return the expected tool call',
      );
    }

    let parsedArgs: { summary: string; operations: unknown };
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new InternalServerErrorException('Model returned malformed JSON');
    }

    // Validation boundary: everything above this line is untrusted
    // model output.
    const operations = validateEditOperations(parsedArgs.operations, existingPaths);

    const changedFiles: string[] = [];
    for (const op of operations) {
      if (op.type === 'delete_file') {
        const { error } = await this.supabase
          .from('project_files')
          .delete()
          .eq('project_id', projectId)
          .eq('path', op.path);
        if (error) throw error;
      } else {
        const { error } = await this.supabase.from('project_files').upsert(
          {
            project_id: projectId,
            path: op.path,
            content: op.content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,path' },
        );
        if (error) throw error;
      }
      changedFiles.push(op.path);
    }

    await this.supabase.from('chat_messages').insert({
      project_id: projectId,
      role: 'assistant',
      content: parsedArgs.summary,
    });

    return { summary: parsedArgs.summary, changedFiles };
  }

  async getHistory(projectId: string) {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async regenerate(_projectId: string, _messageId: string) {
    throw new InternalServerErrorException(
      'Regenerating a specific past message is not implemented yet',
    );
  }
}
