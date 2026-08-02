import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { GENERATE_PROJECT_TOOL } from './prompt-templates/generate-project-tool';
import { EDIT_PROJECT_TOOL } from './prompt-templates/edit-project-tool';
import {
  GENERATE_PROJECT_SYSTEM_PROMPT,
  EDIT_PROJECT_SYSTEM_PROMPT,
  REVIEW_PROJECT_SYSTEM_PROMPT,
} from './prompt-templates/system-prompt';
import { validateGeneratedFiles, validateEditOperations } from './file-op-parser';
import { GithubService } from '../github/github.service';

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    private readonly githubService: GithubService,
  ) {
    const apiKey = this.config.get<string>('openai.apiKey');
    this.openai = new OpenAI({ apiKey });
  }

  async generateInitialProject(
    projectId: string,
    prompt: string,
    imageBase64?: string,
  ): Promise<{ summary: string; fileCount: number }> {
    const apiKey = this.config.get<string>('openai.apiKey');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENAI_API_KEY is not configured on the server',
      );
    }

    const userContent = this.buildUserContent(prompt, imageBase64);

    let completion;
    try {
      completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: GENERATE_PROJECT_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
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

    let parsedArgs: { designPlan: string; summary: string; files: unknown };
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new InternalServerErrorException('Model returned malformed JSON');
    }

    const files = validateGeneratedFiles(parsedArgs.files);
    const reviewedFiles = await this.reviewFiles(files, parsedArgs.designPlan);

    const rows = reviewedFiles.map((f) => ({
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

    await this.commitToGithub(projectId, reviewedFiles, 'Initial generation');

    return { summary: parsedArgs.summary, fileCount: reviewedFiles.length };
  }

  /**
   * Second AI pass: shows the just-generated files back to the model
   * as a strict design reviewer and asks it to catch and fix quality
   * issues a first pass tends to miss (spacing, contrast, overlap,
   * generic placeholder content, etc). Roughly doubles generation
   * cost and latency, so it only runs once per initial generation,
   * not on every chat edit.
   *
   * Fails soft: if the review call errors or returns something that
   * doesn't validate, we log a warning and fall back to the
   * unreviewed files rather than failing the whole generation.
   */
  private async reviewFiles(
    files: { path: string; content: string }[],
    designPlan: string,
  ): Promise<{ path: string; content: string }[]> {
    try {
      const filesContext = files
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join('\n\n');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: REVIEW_PROJECT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Original design plan:\n${designPlan}\n\nGenerated files:\n\n${filesContext}`,
          },
        ],
        tools: [GENERATE_PROJECT_TOOL],
        tool_choice: {
          type: 'function',
          function: { name: 'create_project_files' },
        },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== 'create_project_files') {
        this.logger.warn('Review pass returned no tool call, keeping original files');
        return files;
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      const reviewed = validateGeneratedFiles(parsed.files);
      return reviewed.length > 0 ? reviewed : files;
    } catch (err) {
      this.logger.warn(
        `Review pass failed, keeping original files: ${err instanceof Error ? err.message : err}`,
      );
      return files;
    }
  }

  private buildUserContent(
    prompt: string,
    imageBase64?: string,
  ): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
    if (!imageBase64) {
      return prompt;
    }

    const dataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    return [
      {
        type: 'text',
        text: `${prompt}\n\nMatch the attached design image as closely as possible: layout, colors, spacing, and components.`,
      },
      {
        type: 'image_url',
        image_url: { url: dataUri, detail: 'high' },
      },
    ];
  }

  private async commitToGithub(
    projectId: string,
    files: { path: string; content: string }[],
    message: string,
  ) {
    try {
      await this.githubService.commitFiles(projectId, files, message);
    } catch (err) {
      this.logger.warn(
        `GitHub commit skipped for project ${projectId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

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

    const operations = validateEditOperations(parsedArgs.operations, existingPaths);

    const changedFiles: string[] = [];
    const filesToCommit: { path: string; content: string }[] = [];
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
        filesToCommit.push({ path: op.path, content: op.content! });
      }
      changedFiles.push(op.path);
    }

    if (filesToCommit.length > 0) {
      await this.commitToGithub(projectId, filesToCommit, parsedArgs.summary);
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
