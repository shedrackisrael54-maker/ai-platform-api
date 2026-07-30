import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './entities/create-project.dto';
import { UpdateProjectDto } from './entities/update-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Req() req: any) {
    return this.projectsService.listForUser(req.user.id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateProjectDto) {
    // Kicks off an async AI-generation job; returns immediately with
    // a project record + jobId. Client subscribes to progress via
    // the realtime gateway.
    return this.projectsService.createFromPrompt(req.user.id, dto);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getById(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.remove(req.user.id, id);
  }

  @Get(':id/versions')
  listVersions(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listVersions(req.user.id, id);
  }

  @Post(':id/versions/:versionId/restore')
  restoreVersion(
    @Req() req: any,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projectsService.restoreVersion(req.user.id, id, versionId);
  }
}
