import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';

/**
 * All Vercel API interaction. Uses Vercel's direct-upload deployment
 * API (files inlined in the request) rather than a Git-connected
 * deployment, since generated projects don't have their own GitHub
 * repo yet (that's Milestone 7). Scoped to a personal/team API
 * token, never anything broader.
 */
@Injectable()
export class VercelService {
  constructor(
    private readonly config: ConfigService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  private getToken(): string {
    const token = this.config.get<string>('vercel.apiToken');
    if (!token) {
      throw new InternalServerErrorException('VERCEL_API_TOKEN is not configured on the server');
    }
    return token;
  }

  private slugify(name: string, projectId: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    // Suffix with part of the project id to keep deployments from
    // different projects with the same name from colliding.
    return `${slug || 'app'}-${projectId.slice(0, 8)}`;
  }

  async deployProject(projectId: string) {
    const token = this.getToken();
    const teamId = this.config.get<string>('vercel.teamId');

    const { data: project, error: projectError } = await this.supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();
    if (projectError || !project) throw new NotFoundException('Project not found');

    const { data: files, error: filesError } = await this.supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId);
    if (filesError) throw filesError;
    if (!files || files.length === 0) {
      throw new InternalServerErrorException('Project has no files to deploy yet');
    }

    const { data: deploymentRow, error: insertError } = await this.supabase
      .from('deployments')
      .insert({ project_id: projectId, provider: 'vercel', status: 'building' })
      .select()
      .single();
    if (insertError) throw insertError;

    const name = this.slugify(project.name ?? 'app', projectId);
    const url = new URL('https://api.vercel.com/v13/deployments');
    url.searchParams.set('skipAutoDetectionConfirmation', '1');
    if (teamId) url.searchParams.set('teamId', teamId);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          target: 'production',
          files: files.map((f) => ({ file: f.path, data: f.content })),
          projectSettings: { framework: null },
        }),
      });
    } catch (err) {
      await this.markFailed(deploymentRow.id);
      throw new InternalServerErrorException(
        `Vercel request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    const data = await response.json();

    if (!response.ok) {
      await this.markFailed(deploymentRow.id);
      throw new InternalServerErrorException(
        `Vercel deployment failed: ${data?.error?.message ?? JSON.stringify(data)}`,
      );
    }

    const liveUrl = `https://${data.url}`;
    const { data: updated, error: updateError } = await this.supabase
      .from('deployments')
      .update({
        external_deployment_id: data.id,
        status: 'ready',
        url: liveUrl,
      })
      .eq('id', deploymentRow.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return updated;
  }

  private async markFailed(deploymentRowId: string) {
    await this.supabase
      .from('deployments')
      .update({ status: 'error' })
      .eq('id', deploymentRowId);
  }

  async listDeployments(projectId: string) {
    const { data, error } = await this.supabase
      .from('deployments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getStatus(projectId: string, deploymentId: string) {
    const { data, error } = await this.supabase
      .from('deployments')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', deploymentId)
      .single();
    if (error || !data) throw new NotFoundException('Deployment not found');
    return data;
  }
}
