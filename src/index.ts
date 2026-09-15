import { createApp } from './app.js';
import { env } from './config/environment.js';
import { logger } from './config/logger.js';

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    logger.info(`⚡ Lumina Grid API server running on port ${env.PORT} in [${env.NODE_ENV}] mode`);
    logger.info(`🩺 Health check accessible at http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });
}

export default app;
