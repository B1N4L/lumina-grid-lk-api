import { describe, it, expect, beforeAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { authenticateDevice } from '../../src/middleware/auth-device.middleware.js';
import { authenticateUser, requireRole } from '../../src/middleware/auth-user.middleware.js';
import {
  requireJurisdiction,
  enforceQueryJurisdiction,
} from '../../src/middleware/require-jurisdiction.middleware.js';
import { notFoundHandler } from '../../src/middleware/not-found.middleware.js';
import { errorHandler } from '../../src/middleware/error.middleware.js';
import { signUserToken, verifyUserToken } from '../../src/utils/jwt.js';
import { hashPassword, comparePassword, hashApiKey } from '../../src/utils/crypto.js';
import { UserTokenPayload } from '../../src/types/auth.types.js';

describe('Phase 5: Authentication & Authorization Engine Integration Tests', () => {
  const liveApp = createApp();
  let testApp: Express;

  // Tokens acquired via login for role/jurisdiction matrix testing
  let adminToken: string;
  let provincialAnalystToken: string;
  let districtOperatorToken: string;

  // Known seed device credentials
  const validInstallationId = 'inst-lk-0001';
  const validMeterId = 'MTR-SLSEA-0001';
  const validDeviceKey = `sec_dev_${validInstallationId}_${crypto.createHash('md5').update(validMeterId).digest('hex').substring(0, 16)}`;

  // Known maintenance installation (index 20 in generator: inst-lk-0020)
  const maintenanceInstallationId = 'inst-lk-0020';
  const maintenanceMeterId = 'MTR-SLSEA-0020';
  const maintenanceDeviceKey = `sec_dev_${maintenanceInstallationId}_${crypto.createHash('md5').update(maintenanceMeterId).digest('hex').substring(0, 16)}`;

  beforeAll(async () => {
    // Acquire tokens from live login endpoint
    const adminRes = await request(liveApp)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@slsea.gov.lk', password: 'Slsea@2026!' });
    adminToken = adminRes.body.token;

    const analystRes = await request(liveApp)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst.western@slsea.gov.lk', password: 'Slsea@2026!' });
    provincialAnalystToken = analystRes.body.token;

    const operatorRes = await request(liveApp)
      .post('/api/v1/auth/login')
      .send({ email: 'operator.colombo@slsea.gov.lk', password: 'Slsea@2026!' });
    districtOperatorToken = operatorRes.body.token;

    // Set up dedicated test harness router for security middleware isolation
    testApp = express();
    testApp.use(express.json());

    // 1. Device Write-Path Protected Route
    testApp.post(
      '/api/v1/installations/:installationId/readings',
      authenticateDevice,
      (req, res) => {
        res.status(201).json({
          status: 'success',
          device: req.device,
        });
      }
    );

    // 2. User Protected Route & Role Protected Route
    testApp.get('/api/v1/protected-user', authenticateUser, (req, res) => {
      res.status(200).json({ status: 'success', user: req.user });
    });

    testApp.get(
      '/api/v1/admin-only',
      authenticateUser,
      requireRole('national_admin'),
      (_req, res) => {
        res.status(200).json({ status: 'success', message: 'Welcome National Admin' });
      }
    );

    // 3. Jurisdiction Scoped Routes
    testApp.get(
      '/api/v1/provinces/:id',
      authenticateUser,
      requireJurisdiction({ entityType: 'province' }),
      (req, res) => {
        res.status(200).json({ provinceId: req.params.id });
      }
    );

    testApp.get(
      '/api/v1/districts/:id',
      authenticateUser,
      requireJurisdiction({ entityType: 'district' }),
      (req, res) => {
        res.status(200).json({ districtId: req.params.id });
      }
    );

    testApp.get(
      '/api/v1/grid-substations/:id',
      authenticateUser,
      requireJurisdiction({ entityType: 'substation' }),
      (req, res) => {
        res.status(200).json({ substationId: req.params.id });
      }
    );

    testApp.get(
      '/api/v1/installations/:id',
      authenticateUser,
      requireJurisdiction({ entityType: 'installation' }),
      (req, res) => {
        res.status(200).json({ installationId: req.params.id });
      }
    );

    testApp.get(
      '/api/v1/installations',
      authenticateUser,
      enforceQueryJurisdiction,
      (req, res) => {
        res.status(200).json({ query: req.query });
      }
    );

    testApp.use(notFoundHandler);
    testApp.use(errorHandler);
  });

  // =========================================================================
  // 1. CRYPTO & JWT UTILITIES
  // =========================================================================
  describe('Crypto & JWT Utilities', () => {
    it('should hash and compare passwords correctly using bcrypt', async () => {
      const password = 'TestSecretPassword@123';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
      expect(await comparePassword(password, hash)).toBe(true);
      expect(await comparePassword('WrongPassword', hash)).toBe(false);
    });

    it('should compute deterministic SHA-256 hash for device API keys', () => {
      const key = 'sec_dev_inst-lk-0001_caaf80f7fae3f365';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should sign and verify valid user tokens', () => {
      const payload: UserTokenPayload = {
        sub: 'a0000000-0000-0000-0000-000000000001',
        email: 'test@slsea.gov.lk',
        role: 'provincial_analyst',
        fullName: 'Test Analyst',
        jurisdictionProvinceId: 'lk-wp',
        jurisdictionDistrictId: null,
      };

      const token = signUserToken(payload, '1h');
      expect(typeof token).toBe('string');

      const decoded = verifyUserToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.jurisdictionProvinceId).toBe('lk-wp');
    });

    it('should reject tampered or invalid tokens with UnauthorizedError', () => {
      expect(() => verifyUserToken('invalid.jwt.token')).toThrow();
    });
  });

  // =========================================================================
  // 2. USER LOGIN ENDPOINT (POST /api/v1/auth/login)
  // =========================================================================
  describe('POST /api/v1/auth/login (User Authentication)', () => {
    it('should authenticate national_admin with valid credentials and return JWT', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@slsea.gov.lk', password: 'Slsea@2026!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.tokenType).toBe('Bearer');
      expect(res.body.user).toMatchObject({
        email: 'admin@slsea.gov.lk',
        fullName: 'National Grid Controller',
        role: 'national_admin',
        jurisdictionProvinceId: null,
        jurisdictionDistrictId: null,
      });

      // Verify returned token signature and payload
      const verified = verifyUserToken(res.body.token);
      expect(verified.role).toBe('national_admin');
      expect(verified.email).toBe('admin@slsea.gov.lk');
    });

    it('should authenticate provincial_analyst with province jurisdiction claim', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'analyst.western@slsea.gov.lk', password: 'Slsea@2026!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('provincial_analyst');
      expect(res.body.user.jurisdictionProvinceId).toBe('lk-wp');
      expect(res.body.user.jurisdictionDistrictId).toBeNull();
    });

    it('should authenticate district_operator with district jurisdiction claim', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'operator.colombo@slsea.gov.lk', password: 'Slsea@2026!' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('district_operator');
      expect(res.body.user.jurisdictionProvinceId).toBe('lk-wp');
      expect(res.body.user.jurisdictionDistrictId).toBe('dist-colombo');
    });

    it('should reject incorrect password with 401 Unauthorized', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@slsea.gov.lk', password: 'WrongPassword@999' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should reject non-existent user with 401 Unauthorized', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'unknown.user@slsea.gov.lk', password: 'Slsea@2026!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should return 400 VALIDATION_ERROR on malformed email or missing fields', async () => {
      const res = await request(liveApp)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. DEVICE WRITE-PATH AUTHENTICATION (authenticateDevice)
  // =========================================================================
  describe('Device Write-Path Authentication (authenticateDevice)', () => {
    it('should accept valid X-Device-Key matching the requested installationId', async () => {
      const res = await request(testApp)
        .post(`/api/v1/installations/${validInstallationId}/readings`)
        .set('X-Device-Key', validDeviceKey)
        .send({ test: true });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.device).toMatchObject({
        installationId: validInstallationId,
        meterId: validMeterId,
      });
    });

    it('should return 401 UNAUTHORIZED when X-Device-Key header is missing', async () => {
      const res = await request(testApp)
        .post(`/api/v1/installations/${validInstallationId}/readings`)
        .send({ test: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('X-Device-Key');
    });

    it('should return 401 UNAUTHORIZED when X-Device-Key is invalid', async () => {
      const res = await request(testApp)
        .post(`/api/v1/installations/${validInstallationId}/readings`)
        .set('X-Device-Key', 'sec_dev_invalid_random_token_9999')
        .send({ test: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid device API key');
    });

    it('should return 403 FORBIDDEN when device attempts cross-installation ingestion spoofing', async () => {
      // Key is for inst-lk-0001, but URI requests ingestion for inst-lk-0002
      const res = await request(testApp)
        .post('/api/v1/installations/inst-lk-0002/readings')
        .set('X-Device-Key', validDeviceKey)
        .send({ test: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Device is only authorized for installation');
    });

    it('should return 403 FORBIDDEN when installation status is maintenance', async () => {
      const res = await request(testApp)
        .post(`/api/v1/installations/${maintenanceInstallationId}/readings`)
        .set('X-Device-Key', maintenanceDeviceKey)
        .send({ test: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('maintenance');
    });
  });

  // =========================================================================
  // 4. USER AUTHENTICATION & ROLE-BASED ACCESS CONTROL (authenticateUser, requireRole)
  // =========================================================================
  describe('User Authentication & Role-Based Access Control', () => {
    it('should reject request without Authorization header with 401 UNAUTHORIZED', async () => {
      const res = await request(testApp).get('/api/v1/protected-user');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with non-Bearer Authorization format with 401 UNAUTHORIZED', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected-user')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should accept valid Bearer JWT and populate req.user', async () => {
      const res = await request(testApp)
        .get('/api/v1/protected-user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('national_admin');
    });

    it('should allow national_admin access to admin-only route', async () => {
      const res = await request(testApp)
        .get('/api/v1/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Welcome National Admin');
    });

    it('should deny provincial_analyst access to admin-only route with 403 FORBIDDEN', async () => {
      const res = await request(testApp)
        .get('/api/v1/admin-only')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny district_operator access to admin-only route with 403 FORBIDDEN', async () => {
      const res = await request(testApp)
        .get('/api/v1/admin-only')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 5. JURISDICTION SCOPING ABAC (requireJurisdiction, enforceQueryJurisdiction)
  // =========================================================================
  describe('Jurisdiction-Scoped Authorization ABAC', () => {
    describe('National Admin Nationwide Access', () => {
      it('should allow national admin access to Western Province and Central Province', async () => {
        const wpRes = await request(testApp)
          .get('/api/v1/provinces/lk-wp')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(wpRes.status).toBe(200);

        const cpRes = await request(testApp)
          .get('/api/v1/provinces/lk-cp')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(cpRes.status).toBe(200);
      });

      it('should allow national admin access to Colombo and Kandy districts', async () => {
        const colomboRes = await request(testApp)
          .get('/api/v1/districts/dist-colombo')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(colomboRes.status).toBe(200);

        const kandyRes = await request(testApp)
          .get('/api/v1/districts/dist-kandy')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(kandyRes.status).toBe(200);
      });

      it('should allow national admin unconstrained query filters', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations?province=lk-cp&district=dist-kandy')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
      });
    });

    describe('Provincial Analyst (Western Province - lk-wp)', () => {
      it('should allow access to Western Province (own jurisdiction)', async () => {
        const res = await request(testApp)
          .get('/api/v1/provinces/lk-wp')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(200);
      });

      it('should block access to Central Province (lk-cp) with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/provinces/lk-cp')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow access to districts within Western Province (dist-colombo)', async () => {
        const res = await request(testApp)
          .get('/api/v1/districts/dist-colombo')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(200);
      });

      it('should block access to districts outside Western Province (dist-kandy) with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/districts/dist-kandy')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow access to substations in Western Province (sub-kolonnawa-01)', async () => {
        const res = await request(testApp)
          .get('/api/v1/grid-substations/sub-kolonnawa-01')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(200);
      });

      it('should block access to substations outside Western Province (sub-kandy-01) with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/grid-substations/sub-kandy-01')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should block query filtering by another province with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations?province=lk-cp')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow query filtering by own province', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations?province=lk-wp')
          .set('Authorization', `Bearer ${provincialAnalystToken}`);
        expect(res.status).toBe(200);
      });
    });

    describe('District Operator (Colombo District - dist-colombo)', () => {
      it('should block provincial-level resource access with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/provinces/lk-wp')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow access to own district (dist-colombo)', async () => {
        const res = await request(testApp)
          .get('/api/v1/districts/dist-colombo')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(200);
      });

      it('should block access to adjacent district (dist-gampaha) with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/districts/dist-gampaha')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow access to substation in own district (sub-kolonnawa-01 in Colombo)', async () => {
        const res = await request(testApp)
          .get('/api/v1/grid-substations/sub-kolonnawa-01')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(200);
      });

      it('should block access to substation in different district (sub-kelaniya-01 in Gampaha) with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/grid-substations/sub-kelaniya-01')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow access to installation in own district (inst-lk-0001)', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations/inst-lk-0001')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(200);
      });

      it('should block query filtering by another district with 403 FORBIDDEN', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations?district=dist-kandy')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('should allow query filtering by assigned district', async () => {
        const res = await request(testApp)
          .get('/api/v1/installations?district=dist-colombo')
          .set('Authorization', `Bearer ${districtOperatorToken}`);
        expect(res.status).toBe(200);
      });
    });
  });
});
