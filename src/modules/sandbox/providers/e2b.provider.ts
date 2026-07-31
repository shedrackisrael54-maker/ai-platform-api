import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sandbox } from 'e2b';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../../supabase/supabase.module';
import type {
  ExecResult,
  ISandboxProvider,
  SandboxStatus,
} from './sandbox-provider.interface';

// The project files are static HTML/CSS/JS (see AiOrchestratorService),
// so a plain Python static file server is enough to preview them.
// A real dev-server (Vite, etc.) is a later-milestone concern once
// generated projects grow beyond single-file HTML.
const PREVIEW_PORT = 3000;
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes idle timeout

/**
 * E2B-backed implementation of ISandboxProvider. All E2B SDK calls
 * live in this file and nowhere else in the codebase - see
 * sandbox-provider.interface.ts for why.
 *
 * Sandbox identity is tracked in the `sandboxes` table (one row per
 * project) so repeated calls reconnect to the same running sandbox
 * instead of spinning up a new one every time.
 */
@Injectable()
export class E2bProvider implements ISandboxProvider {
  private readonly logger = new Logger(E2bProvider.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getApiKey(): string {
    const apiKey = this.config.get<string>('e2b.apiKey');
    if (!apiKey) {
      throw new Error('E2B_API_KEY is not configured on the server');
    }
    return apiKey;
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
        provider: 'e2b',
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' },
    );
    if (error) throw error;
  }

  async createSandbox(projectId: string): Promise<SandboxStatus> {
    const apiKey = this.getApiKey();

    // Reuse an existing running sandbox for this project if we have
    // one, rather than creating a duplicate.
    const existing = await this.getSandboxRow(projectId);
    if (existing?.status === 'running' && existing.external_sandbox_id) {
      try {
        const sandbox = await Sandbox.connect(existing.external_sandbox_id, { apiKey });
        const host = sandbox.getHost(PREVIEW_PORT);
        return { state: 'running', previewUrl: `https://${host}` };
      } catch {
        // Sandbox likely expired/died server-side; fall through and
        // create a fresh one instead of failing the request.
        this.logger.warn(`Stale sandbox for project ${projectId}, creating a new one`);
      }
    }

    await this.upsertSandboxRow(projectId, { status: 'provisioning' });

    const sandbox = await Sandbox.create({ apiKey, timeoutMs: SANDBOX_TIMEOUT_MS });

    // Pull the project's generated files from Supabase and write
    // them into the sandbox filesystem.
    const { data: files, error: filesError } = await this.supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId);
    if (filesError) throw filesError;

    if (!files || files.length === 0) {
      throw new Error('Project has no generated files to run yet');
    }

    const writeEntries = files.map((f) => ({
      path: `/home/user/app/${f.path}`,
      data: f.content,
    }));
    await sandbox.files.write(writeEntries);

    // Serve the static files on PREVIEW_PORT in the background.
    await sandbox.commands.run(
      `cd /home/user/app && python3 -m http.server ${PREVIEW_PORT}`,
      { background: true },
    );

    const host = sandbox.getHost(PREVIEW_PORT);
    const previewUrl = `https://${host}`;

    await this.upsertSandboxRow(projectId, {
      external_sandbox_id: sandbox.sandboxId,
      status: 'running',
      preview_url: previewUrl,
    });

    return { state: 'running', previewUrl };
  }

  async destroySandbox(projectId: string): Promise<void> {
    const apiKey = this.getApiKey();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id) return;

    try {
      await Sandbox.kill(row.external_sandbox_id, { apiKey });
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
    const apiKey = this.getApiKey();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await Sandbox.connect(row.external_sandbox_id, { apiKey });
    const result = await sandbox.commands.run(command, { cwd: '/home/user/app' });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }

  async writeFile(projectId: string, path: string, content: string): Promise<void> {
    const apiKey = this.getApiKey();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await Sandbox.connect(row.external_sandbox_id, { apiKey });
    await sandbox.files.write(`/home/user/app/${path}`, content);
  }

  async readFile(projectId: string, path: string): Promise<string> {
    const apiKey = this.getApiKey();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await Sandbox.connect(row.external_sandbox_id, { apiKey });
    const content = await sandbox.files.read(`/home/user/app/${path}`);
    return content as string;
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    const apiKey = this.getApiKey();
    const row = await this.getSandboxRow(projectId);
    if (!row?.external_sandbox_id || row.status !== 'running') {
      throw new Error('No running sandbox for this project - start one first');
    }
    const sandbox = await Sandbox.connect(row.external_sandbox_id, { apiKey });
    await sandbox.files.remove(`/home/user/app/${path}`);
  }
}
