import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { FileSyncService } from './file-sync.service';

@Controller('projects/:projectId/files')
export class FileSyncController {
  constructor(private readonly fileSyncService: FileSyncService) {}

  @Get()
  tree(@Req() req: any, @Param('projectId') projectId: string) {
    return this.fileSyncService.getTree(req.user.id, projectId);
  }

  @Get('*path')
  read(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('path') path: string,
  ) {
    return this.fileSyncService.readFile(req.user.id, projectId, path);
  }

  @Put('*path')
  write(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('path') path: string,
    @Body() body: { content: string },
  ) {
    return this.fileSyncService.writeFile(
      req.user.id,
      projectId,
      path,
      body.content,
    );
  }

  @Post()
  create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { path: string; isDirectory: boolean },
  ) {
    return this.fileSyncService.createEntry(
      req.user.id,
      projectId,
      body.path,
      body.isDirectory,
    );
  }

  @Delete('*path')
  remove(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('path') path: string,
  ) {
    return this.fileSyncService.deleteFile(req.user.id, projectId, path);
  }
}
