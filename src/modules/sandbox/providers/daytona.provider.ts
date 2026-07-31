import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Daytona, Sandbox as DaytonaSandbox } from '@daytonaio/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../../supabase/supabase.module';
import type {
  ExecResult,
  ISandboxProvider,
  SandboxStatus,
} from './sandbox-provider.interface';

// Generated projects are static HTML/CSS/JS (see AiOrchestratorService),
// so a plain Python static file server is enough to preview them.
const PREVIEW_PORT = 3000;
const WORKDIR = 'app';
const PREVIEW_SESSION_ID = 'preview-server';

/**
 * Daytona-backed implementation of ISandboxProvider - an alternative
 * to E2bProvider behind the same interface (see
 * sandbox-provider.interface.ts). Used when E2B isn't reachable;
 * swapping providers is just changing the binding in
 * sandbox.module.ts, nothing else in the app needs to know or care
 * which one is active.
 */
@Injectable()
export class DaytonaProvider implements ISandboxProvider {
  private readonly logger = new Logger(DaytonaProvider.name);
  private client: Daytona | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getClient(): Daytona {
    if (!this.client) {
      const apiKey = this.config.get<string>('daytona.apiKey');
      if (!apiKey) {
        throw new Error('DAYTONA_API_KEY is not configured on the server');
      }
      this.client = new Daytona({ apiKey });
    }
    return this.client;
  }

  private async getSandboxRow(projectId: string) {
    const { data, error } = await this.supabase
      .from('sandboxes')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  private async upsertSandboxRow(
    projectId: string,
    fields: Partial<{
      external_sandbox_id: string;
      status: string;
      preview_url: string | null;
    }>,
  ) {
    const { error } = await this.supabase.from('sandboxes').upsert(
      {
        project_id: projectId,
        provider: 'daytona',
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' },
    );
    if (error) throw error;
  }

  private async connect(sandboxId: string): Promise<DaytonaSandbox> {
    return this.getClient().get(sandboxId);
  }

  async createSandbox(projectId: string): Promise<SandboxStatus> {
    const daytona = this.getClient();

    // Reuse an existing running sandbox for this project if we have
    // one, rather than creating a duplicate.
    const existing = await this.getSandboxRow(projectId);
    if (existing?.status === 'running' && existing.external_sandbox_id) {
      try {
        const sandbox = await this.connect(existing.external_sandbox_id);
        const preview = await sandbox.getPreviewLink(PREVIEW_PORT);
        return { state: 'running', previewUrl: preview.url };
      } catch {
        this.logger.warn(`Stale sandbox for project ${projectId}, creating a new one`);
      }
    }

    await this.upsertSandboxRow(projectId, { status: 'provisioning' });

    const sandbox = await daytona.create();

    const { data: files, error: filesError } = await this.supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId);
    if (filesError) throw filesError;

    if (!files || files.length === 0) {
      throw new Error('Project has no generated files to run yet');
    }

    await sandbox.fs.uploadFiles(
      files.map((f) => ({
        source: Buffer.from(f.content, 'utf8'),
        destination: `${WORKDIR}/${f.path}`,
      })),
    );

    // Run the static file server in a background session so this
    // call returns instead of blocking on a long-lived process.
    await sandbox.process.createSession(PREVIEW_SESSION_ID);
    await sandbox.process.executeSessionCommand(PREVIEW_SESSION_ID, {
      command: `cd ${WORKDIR} && python3 -m http.server ${PREVIEW_PORT}`,
      runAsync: true,
    });

    const preview = await sandbox.getPreviewLink(PREVIEW_PORT);

    await this.upsertSandboxRow(projectId, {
      external_sandbox_id: sandbox.id,
      status: 'running',
      preview_url: preview.url,
    });

    return { state: 'running', previewUrl: preview.url };
  }

  async destroySandbox(projectId: string): Promise<void> {
    const daytona = this.getClient();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id) return;

    try {
      const sandbox = await this.connect(row.external_sandbox_id);
      await daytona.delete(sandbox);
    } catch {
      // Already gone server-side - not an error from our perspective.
    }
    await this.upsertSandboxRow(projectId, { status: 'stopped', preview_url: null });
  }

  async getStatus(projectId: string): Promise<SandboxStatus> {
    const row = await this.getSandboxRow(projectId);
    if (!row) return { state: 'stopped' };
    return {
      state: row.status as SandboxStatus['state'],
      previewUrl: row.preview_url ?? undefined,
    };
  }

  async exec(projectId: string, command: string): Promise<ExecResult> {
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await this.connect(row.external_sandbox_id);
    const result = await sandbox.process.executeCommand(command, WORKDIR);
    return {
      stdout: result.result,
      stderr: '',
      exitCode: result.exitCode,
    };
  }

  async writeFile(projectId: string, path: string, content: string): Promise<void> {
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await this.connect(row.external_sandbox_id);
    await sandbox.fs.uploadFile(Buffer.from(content, 'utf8'), `${WORKDIR}/${path}`);
  }

  async readFile(projectId: string, path: string): Promise<string> {
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await this.connect(row.external_sandbox_id);
    const buffer = await sandbox.fs.downloadFile(`${WORKDIR}/${path}`);
    return buffer.toString('utf8');
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await this.connect(row.external_sandbox_id);
    await sandbox.fs.deleteFile(`${WORKDIR}/${path}`);
  }
}
