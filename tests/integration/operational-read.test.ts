import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';

describe('Phase 7: Operational Read Path & Composite Resources Integration Tests', () => {
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
  // 1. WRITE-READ SPLIT PROTECTION & UNAUTHENTICATED GUARDS
  // =========================================================================
  describe('Write-Read Split & Authentication Invariants', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/provinces');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject metering devices presenting X-Device-Key on read paths with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}`)
        .set('X-Device-Key', rawApiKey);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. PROVINCES HIERARCHY (COLLECTION, ATOMIC, SCOPED SUB-COLLECTION)
  // =========================================================================
  describe('Provinces Hierarchy Endpoints', () => {
    it('GET /api/v1/provinces - should return all 9 provinces with ETag for national_admin', async () => {
      const res = await request(app)
        .get('/api/v1/provinces')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(9);
      expect(res.headers).toHaveProperty('etag');

      const wp = res.body.find((p: { id: string }) => p.id === 'lk-wp');
      expect(wp).toMatchObject({
        id: 'lk-wp',
        name: 'Western Province',
        code: 'WP',
      });
    });

    it('GET /api/v1/provinces - should return 304 Not Modified when If-None-Match matches ETag', async () => {
      const initialRes = await request(app)
        .get('/api/v1/provinces')
        .set('Authorization', `Bearer ${adminToken}`);

      const etag = initialRes.headers.etag;

      const cachedRes = await request(app)
        .get('/api/v1/provinces')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
      expect(cachedRes.text).toBe('');
    });

    it('GET /api/v1/provinces - should reject non-national roles with 403 Forbidden', async () => {
      const analystRes = await request(app)
        .get('/api/v1/provinces')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);
      expect(analystRes.status).toBe(403);

      const operatorRes = await request(app)
        .get('/api/v1/provinces')
        .set('Authorization', `Bearer ${districtOperatorToken}`);
      expect(operatorRes.status).toBe(403);
    });

    it('GET /api/v1/provinces/:id - should return single province for authorized user', async () => {
      const res = await request(app)
        .get('/api/v1/provinces/lk-wp')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'lk-wp',
        name: 'Western Province',
        code: 'WP',
      });
    });

    it('GET /api/v1/provinces/:id - should reject provincial analyst accessing unauthorized province with 403', async () => {
      const res = await request(app)
        .get('/api/v1/provinces/lk-cp')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/provinces/:id - should reject district operator with 403', async () => {
      const res = await request(app)
        .get('/api/v1/provinces/lk-wp')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/provinces/:id - should return 404 for nonexistent province', async () => {
      const res = await request(app)
        .get('/api/v1/provinces/lk-xx')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('GET /api/v1/provinces/:id/districts - should return districts under the specified province', async () => {
      const res = await request(app)
        .get('/api/v1/provinces/lk-wp/districts')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3); // Colombo, Gampaha, Kalutara

      const districtIds = res.body.map((d: { id: string }) => d.id);
      expect(districtIds).toContain('dist-colombo');
      expect(districtIds).toContain('dist-gampaha');
      expect(districtIds).toContain('dist-kalutara');
    });
  });

  // =========================================================================
  // 3. DISTRICTS HIERARCHY (COLLECTION, ATOMIC, SCOPED SUB-COLLECTION)
  // =========================================================================
  describe('Districts Hierarchy Endpoints', () => {
    it('GET /api/v1/districts - should return all 25 districts with ETag for national_admin', async () => {
      const res = await request(app)
        .get('/api/v1/districts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(25);
      expect(res.headers).toHaveProperty('etag');
    });

    it('GET /api/v1/districts - should return 304 Not Modified when If-None-Match matches', async () => {
      const initialRes = await request(app)
        .get('/api/v1/districts')
        .set('Authorization', `Bearer ${adminToken}`);

      const etag = initialRes.headers.etag;

      const cachedRes = await request(app)
        .get('/api/v1/districts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
    });

    it('GET /api/v1/districts - should reject non-national roles with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/districts')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/districts/:id - should return single district for authorized operator', async () => {
      const res = await request(app)
        .get('/api/v1/districts/dist-colombo')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'dist-colombo',
        name: 'Colombo',
        provinceId: 'lk-wp',
        provinceName: 'Western Province',
      });
    });

    it('GET /api/v1/districts/:id - should allow provincial analyst to access district within assigned province', async () => {
      const res = await request(app)
        .get('/api/v1/districts/dist-colombo')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('dist-colombo');
    });

    it('GET /api/v1/districts/:id - should reject district operator accessing other district with 403', async () => {
      const res = await request(app)
        .get('/api/v1/districts/dist-kandy')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/districts/:id/grid-substations - should return substations under district', async () => {
      const res = await request(app)
        .get('/api/v1/districts/dist-colombo/grid-substations')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const substationIds = res.body.map((s: { id: string }) => s.id);
      expect(substationIds).toContain('sub-kolonnawa-01');
    });
  });

  // =========================================================================
  // 4. GRID SUBSTATIONS & LINKED INSTALLATIONS
  // =========================================================================
  describe('Grid Substations Endpoints', () => {
    it('GET /api/v1/grid-substations/:id - should return substation details for authorized district operator', async () => {
      const res = await request(app)
        .get('/api/v1/grid-substations/sub-kolonnawa-01')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'sub-kolonnawa-01',
        name: 'Kolonnawa Grid Substation',
        districtId: 'dist-colombo',
        provinceId: 'lk-wp',
      });
    });

    it('GET /api/v1/grid-substations/:id - should reject cross-district access with 403', async () => {
      const res = await request(app)
        .get('/api/v1/grid-substations/sub-kandy-01')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/grid-substations/:id/installations - should return installations without apiKeyHash and with ETag', async () => {
      const res = await request(app)
        .get('/api/v1/grid-substations/sub-kolonnawa-01/installations')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(8); // 8 per substation
      expect(res.headers).toHaveProperty('etag');

      // Security check: apiKeyHash must be strictly omitted
      for (const inst of res.body) {
        expect(inst).not.toHaveProperty('apiKeyHash');
        expect(inst).toHaveProperty('meterId');
        expect(inst).toHaveProperty('inverterId');
        expect(inst).toHaveProperty('installedCapacityKw');
      }
    });

    it('GET /api/v1/grid-substations/:id/installations - should support 304 Not Modified caching', async () => {
      const initialRes = await request(app)
        .get('/api/v1/grid-substations/sub-kolonnawa-01/installations')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      const etag = initialRes.headers.etag;

      const cachedRes = await request(app)
        .get('/api/v1/grid-substations/sub-kolonnawa-01/installations')
        .set('Authorization', `Bearer ${districtOperatorToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
    });
  });

  // =========================================================================
  // 5. SOLAR INSTALLATIONS (COLLECTION & ATOMIC)
  // =========================================================================
  describe('Solar Installations Collection & Atomic Endpoints', () => {
    it('GET /api/v1/installations - should return paginated installations for national_admin', async () => {
      const res = await request(app)
        .get('/api/v1/installations?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('installations');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.installations.length).toBe(10);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 216,
        totalPages: 22,
      });

      // Verify apiKeyHash is omitted
      for (const inst of res.body.installations) {
        expect(inst).not.toHaveProperty('apiKeyHash');
      }
    });

    it('GET /api/v1/installations - should auto-scope to assigned province for provincial analyst', async () => {
      const res = await request(app)
        .get('/api/v1/installations')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.installations.length).toBeGreaterThan(0);

      // Every returned installation must belong to Western Province
      for (const inst of res.body.installations) {
        expect(inst.provinceId).toBe('lk-wp');
      }
    });

    it('GET /api/v1/installations - should auto-scope to assigned district for district operator', async () => {
      const res = await request(app)
        .get('/api/v1/installations')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.installations.length).toBeGreaterThan(0);

      // Every returned installation must belong to Colombo District
      for (const inst of res.body.installations) {
        expect(inst.districtId).toBe('dist-colombo');
      }
    });

    it('GET /api/v1/installations - should reject cross-jurisdiction filter with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/installations?province=lk-cp')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/installations/:id - should return single installation metadata without apiKeyHash', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: installationId,
        substationId: 'sub-kolonnawa-01',
        meterId: 'MTR-SLSEA-0001',
      });
      expect(res.body).not.toHaveProperty('apiKeyHash');
      expect(res.body).toHaveProperty('substation');
      expect(res.body).toHaveProperty('district');
      expect(res.body).toHaveProperty('province');
    });

    it('GET /api/v1/installations/:id - should reject cross-jurisdiction access with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${kandyInstallationId}`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/installations/:id - should return 404 for nonexistent installation', async () => {
      const res = await request(app)
        .get('/api/v1/installations/inst-lk-nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 6. COMPOSITE RESOURCE (GET /installations/:id/composite)
  // =========================================================================
  describe('Composite Resource (GET /api/v1/installations/:id/composite)', () => {
    it('should return installation bundled with substation, district, province, and operational summary', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/composite`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('etag');

      expect(res.body).toMatchObject({
        id: installationId,
        substation: {
          id: 'sub-kolonnawa-01',
          name: 'Kolonnawa Grid Substation',
        },
        district: {
          id: 'dist-colombo',
          name: 'Colombo',
        },
        province: {
          id: 'lk-wp',
          name: 'Western Province',
        },
      });

      expect(res.body).not.toHaveProperty('apiKeyHash');

      expect(res.body).toHaveProperty('operationalSummary');
      expect(['online', 'degraded', 'offline']).toContain(
        res.body.operationalSummary.status
      );
    });

    it('should support ETag conditional 304 Not Modified caching on composite resource', async () => {
      const initialRes = await request(app)
        .get(`/api/v1/installations/${installationId}/composite`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      const etag = initialRes.headers.etag;

      const cachedRes = await request(app)
        .get(`/api/v1/installations/${installationId}/composite`)
        .set('Authorization', `Bearer ${districtOperatorToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
    });

    it('should reject cross-jurisdiction composite request with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${kandyInstallationId}/composite`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 7. OPERATIONAL DERIVED RESOURCE (GET /installations/:id/last-reading)
  // =========================================================================
  describe('Operational Derived Resource (GET /api/v1/installations/:id/last-reading)', () => {
    it('should return operational status and latest reading for authorized user', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${installationId}/last-reading`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        installationId,
        installationName: expect.any(String),
        installedCapacityKw: expect.any(String),
      });

      expect(['online', 'degraded', 'offline']).toContain(res.body.operationalStatus);
      expect(res.body).toHaveProperty('evaluatedAt');
      expect(res.body).toHaveProperty('reading');
    });

    it('should derive "online" status when a fresh reading (< 30 mins) exists', async () => {
      // Ingest a fresh reading 5 minutes ago via device write path
      const freshTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const readingPayload = {
        timestamp: freshTimestamp,
        power_kw: 4.5,
        energy_kwh: 2000.5,
        voltage: 230.0,
        current_a: 19.5,
        frequency_hz: 50.01,
      };

      const writeRes = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(readingPayload);

      expect(writeRes.status).toBe(201);

      // Now query last-reading
      const readRes = await request(app)
        .get(`/api/v1/installations/${installationId}/last-reading`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.operationalStatus).toBe('online');
      expect(readRes.body.ageMinutes).toBeLessThanOrEqual(30);
      expect(readRes.body.reading).not.toBeNull();
      expect(readRes.body.reading.powerKw).toBe(4.5);
    });

    it('should reject cross-jurisdiction last-reading request with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/installations/${kandyInstallationId}/last-reading`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for nonexistent installation on last-reading', async () => {
      const res = await request(app)
        .get('/api/v1/installations/inst-lk-unknown/last-reading')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
