import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';

/**
 * All GitHub API interaction. Uses a single platform-owned personal
 * access token (GITHUB_TOKEN) to create one private repo per project
 * under that token's account - not a per-user GitHub App/OAuth flow
 * yet (that's a natural hardening step once there's real multi-user
 * load, per the architecture doc's security notes on scoped tokens).
 *
 * Git is the durable, versioned source of truth for a project's code;
 * project_files in Supabase is a fast-access cache the rest of the
 * app reads/writes day-to-day. Every generation and edit commits here.
 */
@Injectable()
export class GithubService {
  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getToken(): string {
    const token = this.config.get<string>('github.token');
    if (!token) {
      throw new InternalServerErrorException('GITHUB_TOKEN is not configured on the server');
    }
    return token;
  }

  private async githubFetch(path: string, options: RequestInit = {}) {
    const token = this.getToken();
    const res = await fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return res;
  }

  private slugify(name: string, projectId: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `${slug || 'project'}-${projectId.slice(0, 8)}`;
  }

  /**
   * Creates a private repo for this project if one doesn't already
   * exist (checked via projects.github_repo_url), and returns
   * { owner, repo }. Idempotent - safe to call before every commit.
   */
  async ensureRepo(projectId: string): Promise<{ owner: string; repo: string }> {
    const { data: project, error } = await this.supabase
      .from('projects')
      .select('name, github_repo_url')
      .eq('id', projectId)
      .single();
    if (error || !project) throw new InternalServerErrorException('Project not found');

    if (project.github_repo_url) {
      const match = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) return { owner: match[1], repo: match[2] };
    }

    const name = this.slugify(project.name ?? 'project', projectId);
    const res = await this.githubFetch('/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name, private: true, auto_init: false }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Failed to create GitHub repo: ${data?.message ?? JSON.stringify(data)}`,
      );
    }

    await this.supabase
      .from('projects')
      .update({ github_repo_url: data.html_url })
      .eq('id', projectId);

    return { owner: data.owner.login, repo: data.name };
  }

  /**
   * Commits the given files (full current content, not a diff) to
   * the project's repo in one commit per file via the Contents API -
   * simple and reliable for the small file counts this platform
   * generates, at the cost of one API round-trip per file rather
   * than a single tree-based commit.
   */
  async commitFiles(
    projectId: string,
    files: { path: string; content: string }[],
    message: string,
  ): Promise<void> {
    const { owner, repo } = await this.ensureRepo(projectId);

    for (const file of files) {
      // Need the current file's SHA if it already exists, or the
      // Contents API will reject the update as a conflict.
      let existingSha: string | undefined;
      const getRes = await this.githubFetch(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
      );
      if (getRes.ok) {
        const existing = await getRes.json();
        existingSha = existing.sha;
      }

      const putRes = await this.githubFetch(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: Buffer.from(file.content, 'utf8').toString('base64'),
            sha: existingSha,
          }),
        },
      );
      if (!putRes.ok) {
        const data = await putRes.json();
        throw new InternalServerErrorException(
          `Failed to commit ${file.path}: ${data?.message ?? JSON.stringify(data)}`,
        );
      }
    }
  }

  /**
   * Returns commit history for the project's repo - this is the
   * project's version list (see ProjectsService.listVersions).
   */
  async listCommits(projectId: string) {
    const { owner, repo } = await this.ensureRepo(projectId);
    const res = await this.githubFetch(`/repos/${owner}/${repo}/commits?per_page=30`);
    const data = await res.json();
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Failed to list commits: ${data?.message ?? JSON.stringify(data)}`,
      );
    }
    return data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author.date,
    }));
  }

  /**
   * Fetches every file's content as of a given commit and overwrites
   * project_files with it - the "restore this version" operation.
   */
  async restoreCommit(projectId: string, sha: string): Promise<void> {
    const { owner, repo } = await this.ensureRepo(projectId);

    const treeRes = await this.githubFetch(
      `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    );
    const tree = await treeRes.json();
    if (!treeRes.ok) {
      throw new InternalServerErrorException(
        `Failed to read commit tree: ${tree?.message ?? JSON.stringify(tree)}`,
      );
    }

    const blobFiles = tree.tree.filter((t: any) => t.type === 'blob');
    const restoredFiles: { path: string; content: string }[] = [];

    for (const entry of blobFiles) {
      const blobRes = await this.githubFetch(
        `/repos/${owner}/${repo}/git/blobs/${entry.sha}`,
      );
      const blob = await blobRes.json();
      if (!blobRes.ok) continue;
      const content = Buffer.from(blob.content, blob.encoding).toString('utf8');
      restoredFiles.push({ path: entry.path, content });
    }

    await this.supabase.from('project_files').delete().eq('project_id', projectId);
    if (restoredFiles.length > 0) {
      await this.supabase.from('project_files').insert(
        restoredFiles.map((f) => ({ project_id: projectId, path: f.path, content: f.content })),
      );
    }
  }
}
