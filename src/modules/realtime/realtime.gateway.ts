import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

/**
 * Single WebSocket entry point for everything the client needs
 * pushed to it: chat token streaming, build/deploy logs, sandbox
 * status changes. Keeps socket concerns out of business-logic
 * services - they just call emitToProject(...) on this gateway.
 */
@WebSocketGateway({ namespace: 'realtime' })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: any;

  handleConnection(_client: any) {
    // TODO: authenticate the socket connection using the same
    // Supabase JWT, join a room scoped to the user/project.
  }

  handleDisconnect(_client: any) {}

  emitToProject(projectId: string, event: string, payload: unknown) {
    this.server?.to(`project:${projectId}`).emit(event, payload);
  }
}
