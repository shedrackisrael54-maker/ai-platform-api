import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { ProjectsService } from '../projects/projects.service';

/**
 * Reconciles project file state. Milestone 2 scope: files live in
 * the `project_files` table (populated by AiOrchestratorService at
 * generation time) since there's no sandbox yet. Once the sandbox
 * exists (Milestone 3) and Git sync lands (Milestone 7), writes here
 * will fan out to those too - this table then becomes a fast local
 * cache rather than the only copy.
 */
@Injectable()
export class FileSyncService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    private readonly projectsService: ProjectsService,
  ) {}

  async getTree(userId: string, projectId: string) {
    // Throws NotFound/Forbidden if the user doesn't own this project.
    await this.projectsService.getById(userId, projectId);

    const { data, error } = await this.supabase
      .from('project_files')
      .select('path, updated_at')
      .eq('project_id', projectId)
      .order('path', { ascending: true });

    if (error) throw error;
    return data.map((f) => ({ path: f.path, isDirectory: false, updatedAt: f.updated_at }));
  }

  async readFile(userId: string, projectId: string, path: string) {
    await this.projectsService.getById(userId, projectId);

    const { data, error } = await this.supabase
      .from('project_files')
      .select('path, content, updated_at')
      .eq('project_id', projectId)
      .eq('path', path)
      .single();

    if (error || !data) throw new NotFoundException('File not found');
    return data;
  }

  async writeFile(
    userId: string,
    projectId: string,
    path: string,
    content: string,
  ) {
    await this.projectsService.getById(userId, projectId);

    const { data, error } = await this.supabase
      .from('project_files')
      .upsert(
        { project_id: projectId, path, content, updated_at: new Date().toISOString() },
        { onConflict: 'project_id,path' },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createEntry(
    userId: string,
    projectId: string,
    path: string,
    isDirectory: boolean,
  ) {
    if (isDirectory) {
      // No real concept of empty directories in this flat table yet;
      // directories are implied by file paths. Nothing to persist.
      return { path, isDirectory: true };
    }
    return this.writeFile(userId, projectId, path, '');
  }

  async deleteFile(userId: string, projectId: string, path: string) {
    await this.projectsService.getById(userId, projectId);

    const { error } = await this.supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path);

    if (error) throw error;
    return { success: true };
  }
}
