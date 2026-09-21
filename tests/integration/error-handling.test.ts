import { describe, it, expect } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../../src/app.js';
import { validate } from '../../src/middleware/validate.js';
import { contentNegotiation } from '../../src/middleware/content-negotiation.js';
import { notFoundHandler } from '../../src/middleware/not-found.middleware.js';
import { errorHandler } from '../../src/middleware/error.middleware.js';
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  PreconditionFailedError,
} from '../../src/errors/app-error.js';

describe('Error Handling Contract & Content Negotiation Integration Tests', () => {
  // Live app instance for end-to-end routing tests
  const liveApp = createApp();

  // Test harness app for testing domain exception mappings and validation
  let testApp: Express;

  const testSchema = z.object({
    powerKw: z.number().min(0, 'powerKw must be positive'),
    meterId: z.string().min(5, 'meterId must be at least 5 characters'),
  });

  testApp = express();
  testApp.use(contentNegotiation);
  testApp.use(express.json());

  testApp.post('/test/validation', validate({ body: testSchema }), (_req, res) => {
    res.status(200).json({ success: true });
  });

  testApp.get('/test/unauthorized', () => {
    throw new UnauthorizedError('Token is invalid or missing');
  });

  testApp.get('/test/forbidden', () => {
    throw new ForbiddenError('User does not have access to Colombo district');
  });

  testApp.get('/test/conflict', () => {
    throw new ConflictError('A reading at this timestamp already exists');
  });

  testApp.get('/test/precondition-failed', () => {
    throw new PreconditionFailedError('ETag mismatch or conditional precondition failed');
  });

  testApp.get('/test/uncaught-error', () => {
    throw new Error('Simulated unhandled system failure');
  });

  testApp.use(notFoundHandler);
  testApp.use(errorHandler);

  describe('RFC-7807 Error Response Schema Contract', () => {
    it('should return 404 with standardized error payload on undefined route', async () => {
      const response = await request(liveApp).get('/api/v1/undefined-route-sample');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchObject({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: expect.stringContaining('/api/v1/undefined-route-sample'),
          details: [],
          path: '/api/v1/undefined-route-sample',
        },
      });
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should return 400 with MALFORMED_JSON on malformed json payload', async () => {
      const response = await request(testApp)
        .post('/test/validation')
        .set('Content-Type', 'application/json')
        .send('{"powerKw": 45.2, "meterId": invalid-json}');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          code: 'MALFORMED_JSON',
          message: 'Malformed JSON payload in request body',
          details: [],
        },
      });
    });

    it('should return 400 with VALIDATION_ERROR and field details on schema failure', async () => {
      const response = await request(testApp)
        .post('/test/validation')
        .send({ powerKw: -5.0, meterId: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.length).toBe(2);

      const fields = response.body.error.details.map((d: { field?: string }) => d.field);
      expect(fields).toContain('powerKw');
      expect(fields).toContain('meterId');
    });
  });

  describe('Content Negotiation (406 Not Acceptable)', () => {
    it('should reject requests with Accept: text/xml returning 406 Not Acceptable', async () => {
      const response = await request(liveApp)
        .get('/api/v1/health')
        .set('Accept', 'text/xml');

      expect(response.status).toBe(406);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_ACCEPTABLE',
          message: expect.stringContaining('Only \'application/json\' is supported'),
        },
      });
    });

    it('should reject requests with Accept: application/xml returning 406', async () => {
      const response = await request(liveApp)
        .get('/api/v1/health')
        .set('Accept', 'application/xml');

      expect(response.status).toBe(406);
      expect(response.body.error.code).toBe('NOT_ACCEPTABLE');
    });

    it('should accept requests with Accept: application/json returning 200', async () => {
      const response = await request(liveApp)
        .get('/api/v1/health')
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
    });

    it('should accept requests with Accept: */* returning 200', async () => {
      const response = await request(liveApp)
        .get('/api/v1/health')
        .set('Accept', '*/*');

      expect(response.status).toBe(200);
    });

    it('should default to application/json when Accept header is omitted', async () => {
      const response = await request(liveApp).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('Specialized HTTP Domain Exceptions', () => {
    it('should map UnauthorizedError to 401 UNAUTHORIZED', async () => {
      const response = await request(testApp).get('/test/unauthorized');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Token is invalid or missing');
    });

    it('should map ForbiddenError to 403 FORBIDDEN', async () => {
      const response = await request(testApp).get('/test/forbidden');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toBe('User does not have access to Colombo district');
    });

    it('should map ConflictError to 409 CONFLICT', async () => {
      const response = await request(testApp).get('/test/conflict');

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should map PreconditionFailedError to 412 PRECONDITION_FAILED', async () => {
      const response = await request(testApp).get('/test/precondition-failed');

      expect(response.status).toBe(412);
      expect(response.body.error.code).toBe('PRECONDITION_FAILED');
    });

    it('should handle unhandled exceptions gracefully returning 500 INTERNAL_SERVER_ERROR', async () => {
      const response = await request(testApp).get('/test/uncaught-error');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
