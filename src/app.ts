import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/environment.js';
import healthRoutes from './routes/health.routes.js';

export function createApp(): Express {
  const app = express();

  // Security Headers & Cross-Origin Resource Sharing
  app.use(helmet());
  app.use(cors());

  // Request Body Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root Service Descriptor
  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'Lumina Grid LK - Real-Time Solar Generation Data API',
      version: '1.0.0',
      status: 'operational',
      authority: 'Sri Lanka Sustainable Energy Authority (SLSEA)',
      documentation: '/docs',
      endpoints: {
        health: `${env.API_PREFIX}/health`,
      },
    });
  });

  // API v1 Routes
  app.use(env.API_PREFIX, healthRoutes);

  return app;
}
