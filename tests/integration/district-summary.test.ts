import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';

describe('Phase 9: Upper-Band Stretch Goal: District Generation Summary Integration Tests', () => {
  const app = createApp();

  let adminToken: string;
  let provincialAnalystToken: string; // Western Province ('lk-wp')
  let districtOperatorToken: string; // Colombo District ('dist-colombo')

  const colomboDistrictId = 'dist-colombo';
  const kandyDistrictId = 'dist-kandy';

  const colomboInstallationId = 'inst-lk-0001';
  const colomboMeterId = 'MTR-SLSEA-0001';
  const rawApiKey = `sec_dev_${colomboInstallationId}_${crypto.createHash('md5').update(colomboMeterId).digest('hex').substring(0, 16)}`;

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
      const res = await request(app).get(`/api/v1/districts/${colomboDistrictId}/generation-summary`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject metering devices presenting X-Device-Key with 401 Unauthorized', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('X-Device-Key', rawApiKey);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // =========================================================================
  // 2. JURISDICTION ABAC & ERROR CONTRACTS
  // =========================================================================
  describe('Jurisdiction ABAC Scoping & Error Contracts', () => {
    it('should allow national admin access across all districts nationwide', async () => {
      const colomboRes = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(colomboRes.status).toBe(200);

      const kandyRes = await request(app)
        .get(`/api/v1/districts/${kandyDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(kandyRes.status).toBe(200);
    });

    it('should allow provincial analyst to access district within assigned province', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.provinceId).toBe('lk-wp');
    });

    it('should reject provincial analyst accessing district in another province with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${kandyDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow district operator to access their assigned district', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.districtId).toBe(colomboDistrictId);
    });

    it('should reject district operator accessing a different district with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${kandyDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found for nonexistent district', async () => {
      const res = await request(app)
        .get('/api/v1/districts/dist-nonexistent/generation-summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  // =========================================================================
  // 3. DISTRICT SUMMARY AGGREGATE CALCULATIONS
  // =========================================================================
  describe('District Generation Summary Aggregation Engine', () => {
    it('should return complete district generation summary with expected metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        districtId: colomboDistrictId,
        districtName: 'Colombo',
        provinceId: 'lk-wp',
        provinceName: 'Western Province',
        evaluatedAt: expect.any(String),
        total_installations_count: expect.any(Number),
        active_installations_count: expect.any(Number),
        current_total_power_kw: expect.any(Number),
        today_total_energy_kwh: expect.any(Number),
        peak_power_today_kw: expect.any(Number),
      });

      // Colombo has 16 installations (2 substations * 8 installations)
      expect(res.body.total_installations_count).toBeGreaterThanOrEqual(16);
      expect(res.body.current_total_power_kw).toBeGreaterThanOrEqual(0);
      expect(res.body.today_total_energy_kwh).toBeGreaterThanOrEqual(0);
      expect(res.body.peak_power_today_kw).toBeGreaterThanOrEqual(0);

      // Verify camelCase accessors are also populated
      expect(res.body.currentTotalPowerKw).toBe(res.body.current_total_power_kw);
      expect(res.body.todayTotalEnergyKwh).toBe(res.body.today_total_energy_kwh);
      expect(res.body.peakPowerTodayKw).toBe(res.body.peak_power_today_kw);
      expect(res.body.activeInstallationsCount).toBe(res.body.active_installations_count);
      expect(res.body.totalInstallationsCount).toBe(res.body.total_installations_count);
    });

    it('should dynamically reflect newly ingested generation telemetry in district aggregates', async () => {
      // Ingest a fresh reading within the last 5 minutes for an installation in Colombo
      const freshTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const readingPayload = {
        timestamp: freshTimestamp,
        power_kw: 4.75,
        energy_kwh: 3500.75,
        voltage: 230.5,
        current_a: 27.1,
        frequency_hz: 50.00,
      };

      const writeRes = await request(app)
        .post(`/api/v1/installations/${colomboInstallationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(readingPayload);

      expect(writeRes.status).toBe(201);

      // Now query district generation summary
      const summaryRes = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.active_installations_count).toBeGreaterThanOrEqual(1);
      expect(summaryRes.body.current_total_power_kw).toBeGreaterThanOrEqual(4.75);
    });

    it('should support optional date query parameter for historical daily summary', async () => {
      // Use date 3 days ago
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);
      const dateStr = threeDaysAgo.toISOString().split('T')[0]!;

      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary?date=${dateStr}`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('today_total_energy_kwh');
      expect(res.body).toHaveProperty('peak_power_today_kw');
      expect(res.body.today_total_energy_kwh).toBeGreaterThanOrEqual(0);
      expect(res.body.peak_power_today_kw).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 4. HTTP CONDITIONAL GET CACHING (ETag)
  // =========================================================================
  describe('HTTP Conditional GET Caching (ETag)', () => {
    it('should return ETag header on 200 OK response', async () => {
      const res = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty('etag');
    });

    it('should return 304 Not Modified when If-None-Match matches ETag', async () => {
      const initialRes = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      const etag = initialRes.headers.etag;
      expect(etag).toBeDefined();

      const cachedRes = await request(app)
        .get(`/api/v1/districts/${colomboDistrictId}/generation-summary`)
        .set('Authorization', `Bearer ${districtOperatorToken}`)
        .set('If-None-Match', etag);

      expect(cachedRes.status).toBe(304);
      expect(cachedRes.text).toBe('');
    });
  });
});
