import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AiOrchestratorService } from './ai-orchestrator.service';

@Controller('projects/:projectId/chat')
export class AiController {
  constructor(private readonly aiOrchestrator: AiOrchestratorService) {}

  @Post()
  sendMessage(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { message: string },
  ) {
    // Returns a jobId immediately; token stream + resulting file
    // operations are pushed over the realtime gateway.
    return this.aiOrchestrator.enqueueChatTurn(
      req.user.id,
      projectId,
      body.message,
    );
  }

  @Get('history')
  history(@Req() req: any, @Param('projectId') projectId: string) {
    return this.aiOrchestrator.getHistory(req.user.id, projectId);
  }

  @Post(':messageId/regenerate')
  regenerate(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.aiOrchestrator.regenerate(req.user.id, projectId, messageId);
  }
}
