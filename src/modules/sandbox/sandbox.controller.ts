import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { SandboxService } from './sandbox.service';

@Controller('projects/:projectId/sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Post('start')
  start(@Req() req: any, @Param('projectId') projectId: string) {
    return this.sandboxService.start(req.user.id, projectId);
  }

  @Post('stop')
  stop(@Req() req: any, @Param('projectId') projectId: string) {
    return this.sandboxService.stop(req.user.id, projectId);
  }

  @Get('status')
  status(@Req() req: any, @Param('projectId') projectId: string) {
    return this.sandboxService.getStatus(req.user.id, projectId);
  }

  @Post('exec')
  exec(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { command: string },
  ) {
    // Restricted: intended for internal use by the AI/deploy flows,
    // not exposed as a general-purpose shell to the client.
    return this.sandboxService.exec(req.user.id, projectId, body.command);
  }
}
