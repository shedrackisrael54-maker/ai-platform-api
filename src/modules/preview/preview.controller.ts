import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { PreviewService } from './preview.service';

@Controller('projects/:projectId/preview')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  @Get('url')
  getUrl(@Req() req: any, @Param('projectId') projectId: string) {
    return this.previewService.getSignedUrl(req.user.id, projectId);
  }

  @Post('refresh')
  refresh(@Req() req: any, @Param('projectId') projectId: string) {
    return this.previewService.refresh(req.user.id, projectId);
  }
}
