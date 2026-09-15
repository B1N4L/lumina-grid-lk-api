import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health Probe Integration Tests', () => {
  const app = createApp();

  it('GET /api/v1/health should return 200 OK with operational status and diagnostics', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      status: 'operational',
      service: 'Lumina Grid LK - Real-Time Solar Generation Data API',
      authority: 'Sri Lanka Sustainable Energy Authority (SLSEA)',
      version: '1.0.0',
    });
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime_seconds');
    expect(typeof response.body.uptime_seconds).toBe('number');
    expect(response.body).toHaveProperty('diagnostics');
    expect(response.body.diagnostics).toHaveProperty('memory_rss_mb');
    expect(response.body.diagnostics).toHaveProperty('memory_heap_used_mb');
    expect(response.body.diagnostics).toHaveProperty('node_version');
  });

  it('GET / should return 200 OK with root service descriptor and health endpoint link', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: 'Lumina Grid LK - Real-Time Solar Generation Data API',
      version: '1.0.0',
      status: 'operational',
      authority: 'Sri Lanka Sustainable Energy Authority (SLSEA)',
    });
    expect(response.body.endpoints).toHaveProperty('health', '/api/v1/health');
  });
});
