import { Response } from 'express';
import { logger } from '../../shared/logging/index.js';

class SseService {
  private clients = new Map<string, Set<Response>>();

  public addClient(accountId: string, res: Response) {
    if (!this.clients.has(accountId)) {
      this.clients.set(accountId, new Set());
    }
    this.clients.get(accountId)!.add(res);

    logger.debug({ accountId }, 'SSE client connected');

    res.on('close', () => {
      this.removeClient(accountId, res);
    });
  }

  public removeClient(accountId: string, res: Response) {
    const userClients = this.clients.get(accountId);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(accountId);
      }
    }
    logger.debug({ accountId }, 'SSE client disconnected');
  }

  public sendToUser(accountId: string, eventType: string, payload: any) {
    const userClients = this.clients.get(accountId);
    if (userClients && userClients.size > 0) {
      const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const res of userClients) {
        try {
          res.write(message);
        } catch (err) {
          logger.error({ err, accountId }, 'Failed to write SSE message to client');
        }
      }
      logger.debug({ accountId, eventType }, 'SSE message sent to user');
    }
  }

  public broadcast(eventType: string, payload: any) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    let count = 0;
    for (const [accountId, userClients] of this.clients.entries()) {
      for (const res of userClients) {
        try {
          res.write(message);
          count++;
        } catch (err) {
          logger.error({ err, accountId }, 'Failed to write SSE broadcast to client');
        }
      }
    }
    logger.debug({ eventType, count }, 'SSE broadcast sent');
  }
}

export const sseService = new SseService();
