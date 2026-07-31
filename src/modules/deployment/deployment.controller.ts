import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { VercelService } from './vercel.service';
import { ProjectsService } from '../projects/projects.service';

@Controller('projects/:projectId/deployments')
export class DeploymentController {
  constructor(
    private readonly vercelService: VercelService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  async deploy(@Req() req: any, @Param('projectId') projectId: string) {
    await this.projectsService.getById(req.user.id, projectId);
    return this.vercelService.deployProject(projectId);
  }

  @Get()
  async list(@Req() req: any, @Param('projectId') projectId: string) {
    await this.projectsService.getById(req.user.id, projectId);
    return this.vercelService.listDeployments(projectId);
  }

  @Get(':deploymentId/status')
  async status(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    await this.projectsService.getById(req.user.id, projectId);
    return this.vercelService.getStatus(projectId, deploymentId);
  }
}
