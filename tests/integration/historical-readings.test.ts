import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';

describe('Phase 8: Analytical Historical Read Path & Advanced Query Features Integration Tests', () => {
  const app = createApp();

  let adminToken: string;
  let provincialAnalystToken: string; // Western Province ('lk-wp')
  let districtOperatorToken: string; // Colombo District ('dist-colombo')

  const installationId = 'inst-lk-0001'; // Under sub-kolonnawa-01, dist-colombo, lk-wp
  const meterId = 'MTR-SLSEA-0001';
  const rawApiKey = `sec_dev_${installationId}_${crypto.createHash('md5').update(meterId).digest('hex').substring(0, 16)}`;

  const kandyInstallationId = 'inst-lk-0041'; // Under sub-kandy-01, dist-kandy, lk-cp

  beforeAll(async () => {
    // 1. Authenticate as National Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;

    // 2. Authenticate as Provincial Analyst (Western Province)
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst.western@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(analystRes.status).toBe(200);
    provincialAnalystToken = analystRes.body.token;

    // 3. Authenticate as District Operator (Colombo District)
    const operatorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'operator.colombo@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(operatorRes.status).toBe(200);
    districtOperatorToken = operatorRes.body.token;
  });

  // =========================================================================
  // 1. AUTHENTICATION & WRITE-READ SPLIT INVARIANTS
  // =========================================================================
  describe('Authentication & Write-Read Split Invariants', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get(`/api/v1/installations/${installationId}/readings`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject metering devices presenting X-Device-Key on analytical read route with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. JURISDICTION ABAC & ERROR CONTRACTS
  // =========================================================================
  describe('Jurisdiction Scoping & Error Contracts', () => {
    it('should allow national admin nationwide access to historical readings', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('_links');
    });

    it('should allow provincial analyst to access installation within assigned province', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings`)
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject provincial analyst accessing installation outside assigned province with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${kandyInstallationId}/readings`)
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow district operator to access installation within assigned district', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject district operator accessing installation outside assigned district with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${kandyInstallationId}/readings`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found for nonexistent installation', async () => {
      const res = await request(app)
        .get('/api/v1/installations/inst-lk-nonexistent/readings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. PAGINATION & HATEOAS NAVIGATION LINKS
  // =========================================================================
  describe('Pagination Envelope & HATEOAS Link Relations', () => {
    it('should return default pagination (page=1, limit=50) with valid envelope', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 50,
        totalCount: expect.any(Number),
        totalPages: expect.any(Number),
        total_count: expect.any(Number),
        total_pages: expect.any(Number),
      });

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(50);
    });

    it('should return correct HATEOAS link relations on page 1 (prev is null)', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?page=1&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body._links).toMatchObject({
        self: { href: expect.stringContaining('page=1') },
        first: { href: expect.stringContaining('page=1') },
        prev: null,
        next: { href: expect.stringContaining('page=2') },
        last: { href: expect.any(String) },
      });
    });

    it('should return correct HATEOAS link relations on page 2 (prev is page 1)', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?page=2&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body._links).toMatchObject({
        self: { href: expect.stringContaining('page=2') },
        first: { href: expect.stringContaining('page=1') },
        prev: { href: expect.stringContaining('page=1') },
        next: expect.anything(),
        last: { href: expect.any(String) },
      });
    });

    it('should preserve custom query filters across generated HATEOAS links', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?page=1&limit=10&min_power_kw=1.5&sort_by=power_kw&order=asc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body._links.self.href).toContain('min_power_kw=1.5');
      expect(res.body._links.self.href).toContain('sort_by=power_kw');
      expect(res.body._links.self.href).toContain('order=asc');
      if (res.body._links.next) {
        expect(res.body._links.next.href).toContain('min_power_kw=1.5');
        expect(res.body._links.next.href).toContain('sort_by=power_kw');
        expect(res.body._links.next.href).toContain('order=asc');
      }
    });

    it('should respect custom limit parameter', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=5`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(5);
      expect(res.body.pagination.limit).toBe(5);
    });
  });

  // =========================================================================
  // 4. MULTI-ATTRIBUTE FILTERING & SCHEMA VALIDATION
  // =========================================================================
  describe('Multi-Attribute Filtering & Validation', () => {
    it('should filter readings by min_power_kw and max_power_kw boundaries', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?min_power_kw=2.0&max_power_kw=5.0&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const reading of res.body.data) {
        expect(reading.powerKw).toBeGreaterThanOrEqual(2.0);
        expect(reading.powerKw).toBeLessThanOrEqual(5.0);
      }
    });

    it('should support camelCase aliases for query parameters (minPowerKw and maxPowerKw)', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?minPowerKw=1.0&maxPowerKw=4.0&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const reading of res.body.data) {
        expect(reading.powerKw).toBeGreaterThanOrEqual(1.0);
        expect(reading.powerKw).toBeLessThanOrEqual(4.0);
      }
    });

    it('should filter readings by from and to time window', async () => {
      // First get a reference timestamp from the dataset
      const refRes = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=5`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(refRes.status).toBe(200);
      expect(refRes.body.data.length).toBeGreaterThan(0);

      const refDate = new Date(refRes.body.data[0].timestamp);
      const from = new Date(refDate.getTime() - 24 * 3600 * 1000).toISOString();
      const to = new Date(refDate.getTime() + 24 * 3600 * 1000).toISOString();

      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?from=${from}&to=${to}&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const fromTime = new Date(from).getTime();
      const toTime = new Date(to).getTime();

      for (const reading of res.body.data) {
        const readingTime = new Date(reading.timestamp).getTime();
        expect(readingTime).toBeGreaterThanOrEqual(fromTime);
        expect(readingTime).toBeLessThanOrEqual(toTime);
      }
    });

    it('should reject invalid query when to is earlier than from with 400 Bad Request', async () => {
      const from = '2026-03-10T12:00:00.000Z';
      const to = '2026-03-09T12:00:00.000Z';

      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid query when max_power_kw is smaller than min_power_kw with 400 Bad Request', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?min_power_kw=10.0&max_power_kw=2.0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid limit exceeding 200 with 400 Bad Request', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=500`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 5. CONFIGURABLE SORTING
  // =========================================================================
  describe('Configurable Sorting Direction & Columns', () => {
    it('should sort readings by timestamp ascending', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?sort_by=timestamp&order=asc&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(1);

      for (let i = 0; i < res.body.data.length - 1; i++) {
        const curr = new Date(res.body.data[i].timestamp).getTime();
        const next = new Date(res.body.data[i + 1].timestamp).getTime();
        expect(curr).toBeLessThanOrEqual(next);
      }
    });

    it('should sort readings by power_kw descending', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?sort_by=power_kw&order=desc&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(1);

      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(res.body.data[i].powerKw).toBeGreaterThanOrEqual(res.body.data[i + 1].powerKw);
      }
    });

    it('should sort readings by energy_kwh ascending', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?sort_by=energy_kwh&order=asc&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(1);

      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(res.body.data[i].energyKwh).toBeLessThanOrEqual(res.body.data[i + 1].energyKwh);
      }
    });
  });

  // =========================================================================
  // 6. CONDITIONAL GET WITH ETAG & LAST-MODIFIED (304 NOT MODIFIED)
  // =========================================================================
  describe('HTTP Conditional GET Caching (ETag & Last-Modified)', () => {
    it('should return ETag and Last-Modified headers on successful 200 OK response', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('etag');
      expect(res.headers).toHaveProperty('last-modified');
    });

    it('should return 304 Not Modified when If-None-Match matches ETag', async () => {
      const initialRes = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      const etag = initialRes.headers.etag;
      expect(etag).toBeDefined();

      const cachedRes = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
      expect(cachedRes.text).toBe('');
      expect(cachedRes.headers.etag).toBe(etag);
    });

    it('should return 304 Not Modified when If-Modified-Since is >= Last-Modified', async () => {
      const initialRes = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      const lastModified = initialRes.headers['last-modified'];
      expect(lastModified).toBeDefined();

      const cachedRes = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-Modified-Since', lastModified);

      expect(cachedRes.status).toBe(304);
      expect(cachedRes.text).toBe('');
    });

    it('should return 200 OK when If-Modified-Since is older than Last-Modified', async () => {
      const oldDate = new Date(Date.now() - 365 * 24 * 3600 * 1000).toUTCString();

      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/readings?limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-Modified-Since', oldDate);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
