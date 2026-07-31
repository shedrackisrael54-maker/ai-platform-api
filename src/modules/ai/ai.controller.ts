import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.module';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Controller('projects/:projectId/chat')
export class AiController {
  constructor(
    private readonly aiOrchestrator: AiOrchestratorService,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // Small inline ownership check rather than depending on
  // ProjectsService here, which would create a circular module
  // dependency (ProjectsModule already depends on AiModule).
  private async assertOwnership(userId: string, projectId: string) {
    const { data, error } = await this.supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();
    if (error || !data) throw new NotFoundException('Project not found');
    if (data.owner_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }
  }

  @Post()
  async sendMessage(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { message: string },
  ) {
    await this.assertOwnership(req.user.id, projectId);
    return this.aiOrchestrator.applyChatEdit(projectId, body.message);
  }

  @Get('history')
  async history(@Req() req: any, @Param('projectId') projectId: string) {
    await this.assertOwnership(req.user.id, projectId);
    return this.aiOrchestrator.getHistory(projectId);
  }

  @Post(':messageId/regenerate')
  async regenerate(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
  ) {
    await this.assertOwnership(req.user.id, projectId);
    return this.aiOrchestrator.regenerate(projectId, messageId);
  }
}
