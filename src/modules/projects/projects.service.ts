import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { CreateProjectDto } from './entities/create-project.dto';
import { UpdateProjectDto } from './entities/update-project.dto';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { GithubService } from '../github/github.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    private readonly aiOrchestrator: AiOrchestratorService,
    private readonly githubService: GithubService,
  ) {}

  async listForUser(userId: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createFromPrompt(userId: string, dto: CreateProjectDto) {
    const { data: project, error } = await this.supabase
      .from('projects')
      .insert({
        owner_id: userId,
        name: dto.name,
        description: dto.prompt,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;

    try {
      const result = await this.aiOrchestrator.generateInitialProject(
        project.id,
        dto.prompt,
        dto.imageBase64,
      );

      const { data: updated, error: updateError } = await this.supabase
        .from('projects')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', project.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return { ...updated, generationSummary: result.summary, fileCount: result.fileCount };
    } catch (err) {
      this.logger.error(
        `AI generation failed for project ${project.id}: ${err instanceof Error ? err.message : err}`,
      );
      await this.supabase
        .from('projects')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', project.id);

      throw err;
    }
  }

  async getById(userId: string, projectId: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !data) throw new NotFoundException('Project not found');
    if (data.owner_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return data;
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.getById(userId, projectId);

    const { data, error } = await this.supabase
      .from('projects')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async remove(userId: string, projectId: string) {
    await this.getById(userId, projectId);

    const { error } = await this.supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw error;
    return { success: true };
  }

  async listVersions(userId: string, projectId: string) {
    await this.getById(userId, projectId);
    return this.githubService.listCommits(projectId);
  }

  async restoreVersion(userId: string, projectId: string, versionId: string) {
    await this.getById(userId, projectId);
    await this.githubService.restoreCommit(projectId, versionId);
    return { success: true };
  }
}
