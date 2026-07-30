import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { CreateProjectDto } from './entities/create-project.dto';
import { UpdateProjectDto } from './entities/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
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
    // M1 scope: create the project record only. Kicking off the
    // actual AI-generation job against this prompt is M2 (AiModule +
    // the `ai-generation` queue processor) - intentionally not wired
    // here yet so each milestone lands independently.
    const { data, error } = await this.supabase
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
    return data;
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
    // Ownership check first so we never leak existence of another
    // user's project via a permissive update.
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
    // Version history depends on the GitHub sync flow (Milestone M7).
    // Returning an empty list is the correct M1 behavior rather than
    // faking data.
    return [];
  }

  async restoreVersion(
    _userId: string,
    _projectId: string,
    _versionId: string,
  ) {
    throw new Error('Not implemented until Milestone M7 (GitHub sync)');
  }
}
