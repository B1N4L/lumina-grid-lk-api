import { Request, Response } from 'express';
import { env } from '../config/environment.js';

export function getHealthCheck(_req: Request, res: Response): void {
  const uptimeSeconds = Math.floor(process.uptime());
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'operational',
    service: 'Lumina Grid LK - Real-Time Solar Generation Data API',
    authority: 'Sri Lanka Sustainable Energy Authority (SLSEA)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime_seconds: uptimeSeconds,
    diagnostics: {
      memory_rss_mb: +(memoryUsage.rss / (1024 * 1024)).toFixed(2),
      memory_heap_used_mb: +(memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
      node_version: process.version,
    },
  });
}
