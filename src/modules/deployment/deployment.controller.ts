import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { GithubService } from './github.service';
import { VercelService } from './vercel.service';

@Controller('projects/:projectId/deployments')
export class DeploymentController {
  constructor(
    private readonly githubService: GithubService,
    private readonly vercelService: VercelService,
  ) {}

  @Post()
  deploy(@Req() req: any, @Param('projectId') projectId: string) {
    // 1. ensure latest state is committed (GithubService)
    // 2. trigger a Vercel deployment from that commit (VercelService)
    // 3. return a deployment record; status is polled by a queued job
    //    and streamed to the client over the realtime gateway.
    return this.vercelService.deployFromLatestCommit(req.user.id, projectId);
  }

  @Get()
  list(@Req() req: any, @Param('projectId') projectId: string) {
    return this.vercelService.listDeployments(req.user.id, projectId);
  }

  @Get(':deploymentId/status')
  status(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.vercelService.getStatus(req.user.id, projectId, deploymentId);
  }
}
