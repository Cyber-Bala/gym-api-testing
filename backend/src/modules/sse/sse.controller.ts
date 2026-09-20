import { Request, Response } from 'express';
import { sseService } from './sse.service.js';

export const connectSSE = (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required for SSE' });
    return;
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send an initial heartbeat/connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

  // Register client
  sseService.addClient(user.accountId, res);
};
