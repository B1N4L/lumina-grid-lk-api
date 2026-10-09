import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { db, generationReadings } from '../../src/db/index.js';
import { eq, and } from 'drizzle-orm';

describe('Phase 6: Device Write Path & Ingestion Semantics Integration Tests', () => {
  const app = createApp();

  const installationId = 'inst-lk-0001';
  const meterId = 'MTR-SLSEA-0001';
  const rawApiKey = `sec_dev_${installationId}_${crypto.createHash('md5').update(meterId).digest('hex').substring(0, 16)}`;

  // Another installation for spoofing check
  const otherInstallationId = 'inst-lk-0002';

  // Maintenance installation (index 20)
  const maintenanceInstallationId = 'inst-lk-0020';
  const maintenanceMeterId = 'MTR-SLSEA-0020';
  const maintenanceApiKey = `sec_dev_${maintenanceInstallationId}_${crypto.createHash('md5').update(maintenanceMeterId).digest('hex').substring(0, 16)}`;

  // Dynamic timestamps to avoid collision with seeded historical dataset
  const baseTimestamp = new Date(Date.now() - 3600_000).toISOString(); // 1 hour ago
  const validReadingPayload = {
    timestamp: baseTimestamp,
    power_kw: 3.85,
    energy_kwh: 1450.25,
    voltage: 231.4,
    current_a: 16.6,
    frequency_hz: 50.02,
  };

  // =========================================================================
  // 1. SUCCESSFUL INGESTION & REST SEMANTICS (POST 201 + LOCATION HEADER)
  // =========================================================================
  describe('POST /api/v1/installations/:installationId/readings (Successful Ingestion)', () => {
    it('should ingest reading with 201 Created and Location header (snake_case payload)', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(validReadingPayload);

      expect(res.status).toBe(201);
      expect(res.headers).toHaveProperty('location');
      expect(res.headers.location).toMatch(
        new RegExp(`^/api/v1/installations/${installationId}/readings/[a-f0-9-]+$`)
      );

      expect(res.body).toMatchObject({
        installationId,
        powerKw: 3.85,
        energyKwh: 1450.25,
        voltage: 231.4,
        currentA: 16.6,
        frequencyHz: 50.02,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');

      // Verify row persisted in database
      const [persisted] = await db
        .select()
        .from(generationReadings)
        .where(eq(generationReadings.id, res.body.id))
        .limit(1);

      expect(persisted).toBeDefined();
      expect(parseFloat(persisted!.powerKw)).toBe(3.85);
    });

    it('should accept camelCase payload seamlessly', async () => {
      const camelTimestamp = new Date(Date.now() - 3500_000).toISOString();
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          timestamp: camelTimestamp,
          powerKw: 4.12,
          energyKwh: 1451.5,
          voltage: 229.8,
          currentA: 17.9,
          frequencyHz: 49.98,
        });

      expect(res.status).toBe(201);
      expect(res.headers.location).toContain(
        `/api/v1/installations/${installationId}/readings/`
      );
      expect(res.body.powerKw).toBe(4.12);
    });
  });

  // =========================================================================
  // 2. IDEMPOTENT INGESTION & CONFLICT HANDLING
  // =========================================================================
  describe('Idempotent Ingestion & Duplicate Timestamp Semantics', () => {
    const idempotentTimestamp = new Date(Date.now() - 3000_000).toISOString();
    const identicalPayload = {
      timestamp: idempotentTimestamp,
      power_kw: 3.5,
      energy_kwh: 1455.0,
      voltage: 230.0,
      current_a: 15.2,
      frequency_hz: 50.0,
    };

    let originalReadingId: string;

    it('should create initial reading with 201 Created', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(identicalPayload);

      expect(res.status).toBe(201);
      originalReadingId = res.body.id;
    });

    it('should handle identical duplicate timestamp idempotently without duplicate row insertion', async () => {
      // Re-send the exact same payload (simulating network retry)
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(identicalPayload);

      // Returns 200 OK on idempotent replay with existing reading and Location header
      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBe(originalReadingId);
      expect(res.headers.location).toBe(
        `/api/v1/installations/${installationId}/readings/${originalReadingId}`
      );

      // Verify no duplicate row was created in database
      const rows = await db
        .select()
        .from(generationReadings)
        .where(
          and(
            eq(generationReadings.installationId, installationId),
            eq(generationReadings.timestamp, new Date(idempotentTimestamp))
          )
        );

      expect(rows.length).toBe(1);
    });

    it('should reject conflicting values at the same timestamp with 409 CONFLICT', async () => {
      // Send DIFFERENT power at the already-ingested timestamp
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...identicalPayload,
          power_kw: 1.0, // Different power!
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('conflicting generation reading');
    });
  });

  // =========================================================================
  // 3. PHYSICAL & ELECTRICAL BOUNDS VALIDATION (400 BAD REQUEST)
  // =========================================================================
  describe('Zod Electrical & Physical Bounds Validation', () => {
    it('should reject negative power with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          power_kw: -2.5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject zero or negative cumulative energy with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          energy_kwh: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject out-of-bounds grid voltage (< 180V or > 260V)', async () => {
      const lowVoltageRes = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          voltage: 150.0, // Below 180V
        });

      expect(lowVoltageRes.status).toBe(400);
      expect(lowVoltageRes.body.error.code).toBe('VALIDATION_ERROR');

      const highVoltageRes = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          voltage: 280.0, // Above 260V
        });

      expect(highVoltageRes.status).toBe(400);
      expect(highVoltageRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject out-of-bounds grid frequency (< 47Hz or > 53Hz)', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          frequency_hz: 44.0, // Severe grid excursion below 47Hz
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject future timestamps with 400 VALIDATION_ERROR', async () => {
      const futureTimestamp = new Date(Date.now() + 86400_000).toISOString(); // Tomorrow
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          timestamp: futureTimestamp,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('future');
    });

    it('should reject power exceeding installation capacity bound (capacity * 1.2)', async () => {
      // inst-lk-0001 has 5.00 kW capacity. Max bound = 5.00 * 1.2 = 6.00 kW
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send({
          ...validReadingPayload,
          timestamp: new Date(Date.now() - 2500_000).toISOString(),
          power_kw: 25.0, // 25 kW >> 6.0 kW!
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('exceeds maximum permissible threshold');
    });
  });

  // =========================================================================
  // 4. DEVICE SECURITY & WRITE-PATH ISOLATION
  // =========================================================================
  describe('Device Security & Write-Path Access Control', () => {
    it('should reject request without X-Device-Key header with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .send(validReadingPayload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid device key with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${installationId}/readings`)
        .set('X-Device-Key', 'sec_dev_invalid_tampered_key_9999')
        .send(validReadingPayload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should block cross-installation spoofing with 403 FORBIDDEN', async () => {
      // Device key for inst-lk-0001 attempting to ingest for inst-lk-0002
      const res = await request(app)
        .post(`/api/v1/installations/${otherInstallationId}/readings`)
        .set('X-Device-Key', rawApiKey)
        .send(validReadingPayload);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Device is only authorized for installation');
    });

    it('should block ingestion for maintenance installation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post(`/api/v1/installations/${maintenanceInstallationId}/readings`)
        .set('X-Device-Key', maintenanceApiKey)
        .send({
          ...validReadingPayload,
          power_kw: 1.0,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('maintenance');
    });
  });
});
