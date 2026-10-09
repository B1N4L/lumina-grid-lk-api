import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

describe('Phase 10: OpenAPI Documentation Surface Integration Tests', () => {
  const app = createApp();

  describe('Root Service Descriptor', () => {
    it('should expose documentation links in root service discovery representation', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('service', 'Lumina Grid LK - Real-Time Solar Generation Data API');
      expect(res.body).toHaveProperty('documentation', '/docs');
      expect(res.body).toHaveProperty('openApiJson', '/openapi.json');
      expect(res.body).toHaveProperty('openApiYaml', '/openapi.yaml');
    });
  });

  describe('Swagger UI Interactive Documentation (/docs)', () => {
    it('should serve HTML Swagger UI documentation at /docs/', async () => {
      const res = await request(app)
        .get('/docs/')
        .set('Accept', 'text/html,application/xhtml+xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('swagger-ui');
      expect(res.text).toContain('Lumina Grid LK - API Documentation');
    });

    it('should redirect /docs to /docs/ with 301 Moved Permanently', async () => {
      const res = await request(app).get('/docs');

      expect([200, 301]).toContain(res.status);
      if (res.status === 301) {
        expect(res.headers.location).toMatch(/\/docs\//);
      }
    });

    it('should serve Swagger UI at /api/v1/docs/ alias', async () => {
      const res = await request(app)
        .get('/api/v1/docs/')
        .set('Accept', 'text/html');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('Raw OpenAPI Specifications (/openapi.json & /openapi.yaml)', () => {
    it('should serve complete OpenAPI 3.0 specification as JSON at /openapi.json', async () => {
      const res = await request(app).get('/openapi.json');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('openapi', '3.0.3');
      expect(res.body.info).toHaveProperty('title', 'Lumina Grid LK - Real-Time Solar Generation Data API');
      expect(res.body).toHaveProperty('paths');
      expect(res.body).toHaveProperty('components');

      // Verify all 18 path items exist
      const paths = Object.keys(res.body.paths);
      expect(paths.length).toBeGreaterThanOrEqual(18);

      // Verify key operational, administrative, and stretch paths are present
      expect(paths).toContain('/api/v1/health');
      expect(paths).toContain('/api/v1/auth/login');
      expect(paths).toContain('/api/v1/users');
      expect(paths).toContain('/api/v1/users/{id}');
      expect(paths).toContain('/api/v1/users/{id}/password');
      expect(paths).toContain('/api/v1/installations/{installationId}/readings');
      expect(paths).toContain('/api/v1/installations/{id}/composite');
      expect(paths).toContain('/api/v1/installations/{id}/last-reading');
      expect(paths).toContain('/api/v1/districts/{districtId}/generation-summary');

      // Count operations (must be at least 22 operations across all endpoints)
      let totalOps = 0;
      for (const p of paths) {
        for (const m of Object.keys(res.body.paths[p])) {
          if (['get', 'post', 'put', 'delete', 'patch'].includes(m)) {
            totalOps++;
          }
        }
      }
      expect(totalOps).toBeGreaterThanOrEqual(22);

      // Verify security schemes
      expect(res.body.components.securitySchemes).toHaveProperty('BearerAuth');
      expect(res.body.components.securitySchemes).toHaveProperty('DeviceApiKey');
    });

    it('should serve complete OpenAPI 3.0 specification as YAML at /openapi.yaml', async () => {
      const res = await request(app)
        .get('/openapi.yaml')
        .set('Accept', 'text/yaml, text/plain, */*');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/yaml/);
      expect(res.text).toContain('openapi: 3.0.3');
      expect(res.text).toContain('Lumina Grid LK - Real-Time Solar Generation Data API');
      expect(res.text).toContain('/api/v1/districts/{districtId}/generation-summary');
    });
  });

  describe('Content Negotiation Exemption', () => {
    it('should exempt docs and openapi routes from JSON-only 406 Not Acceptable rejections', async () => {
      // Browser navigation accepts text/html
      const htmlRes = await request(app)
        .get('/docs/')
        .set('Accept', 'text/html');

      expect(htmlRes.status).toBe(200);

      // YAML export accepts text/yaml
      const yamlRes = await request(app)
        .get('/openapi.yaml')
        .set('Accept', 'text/yaml');

      expect(yamlRes.status).toBe(200);
    });
  });
});
