import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema/index.js';
import { env } from '../config/environment.js';

const connectionString = env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required to establish database connection.');
}

// Neon HTTP serverless driver with connection-pooling resilience
const client = neon(connectionString);
export const db = drizzle(client, { schema });

export type DatabaseInstance = typeof db;
export * from './schema/index.js';
