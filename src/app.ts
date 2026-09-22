import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/environment.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import readingWriteRoutes from './routes/reading-write.routes.js';
import hierarchyRoutes from './routes/hierarchy.routes.js';
import { notFoundHandler } from './middleware/not-found.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { contentNegotiation } from './middleware/content-negotiation.js';

export function createApp(): Express {
  const app = express();

  // Security Headers & Cross-Origin Resource Sharing
  app.use(helmet());
  app.use(cors());

  // Content Negotiation (enforces 406 on unsupported representations)
  app.use(contentNegotiation);

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
        login: `${env.API_PREFIX}/auth/login`,
        users: `${env.API_PREFIX}/users`,
        provinces: `${env.API_PREFIX}/provinces`,
        districts: `${env.API_PREFIX}/districts`,
        readingsIngestion: `${env.API_PREFIX}/installations/:installationId/readings`,
      },
    });
  });

  // API v1 Routes
  app.use(env.API_PREFIX, healthRoutes);
  app.use(`${env.API_PREFIX}/auth`, authRoutes);
  app.use(`${env.API_PREFIX}/users`, userRoutes);
  app.use(env.API_PREFIX, readingWriteRoutes);
  app.use(env.API_PREFIX, hierarchyRoutes);

  // 404 Catch-All & Global Error Middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

