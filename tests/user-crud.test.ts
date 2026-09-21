import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, users } from '../src/db/index.js';
import { eq } from 'drizzle-orm';

describe('Phase 5.5: Administrative User Management Subsystem (User CRUD) Integration Tests', () => {
  const app = createApp();

  let adminToken: string;
  let adminId: string;
  let provincialAnalystToken: string;
  let districtOperatorToken: string;

  beforeAll(async () => {
    // Acquire tokens via live login endpoint
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
    adminId = adminRes.body.user.id;

    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'analyst.western@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(analystRes.status).toBe(200);
    provincialAnalystToken = analystRes.body.token;

    const operatorRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'operator.colombo@slsea.gov.lk', password: 'Slsea@2026!' });
    expect(operatorRes.status).toBe(200);
    districtOperatorToken = operatorRes.body.token;
  });

  // =========================================================================
  // 1. USER CREATION & SANITIZATION (POST /api/v1/users)
  // =========================================================================
  describe('POST /api/v1/users (User Creation)', () => {
    const testEmail = `test.analyst.${Date.now()}@slsea.gov.lk`;
    let createdUserId: string;

    it('should create a provincial analyst with 201 Created and Location header', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: testEmail,
          password: 'SecurePassword@2026!',
          fullName: 'Test Provincial Analyst',
          role: 'provincial_analyst',
          jurisdictionProvinceId: 'lk-wp',
        });

      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/v1/users/${res.body.id}`);
      expect(res.body).toMatchObject({
        email: testEmail,
        fullName: 'Test Provincial Analyst',
        role: 'provincial_analyst',
        status: 'active',
        jurisdictionProvinceId: 'lk-wp',
        jurisdictionDistrictId: null,
      });

      // Strict security: passwordHash must NEVER be leaked in responses
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body).not.toHaveProperty('password');

      createdUserId = res.body.id;
    });

    it('should return 409 CONFLICT when creating a user with an existing active email', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: testEmail, // Duplicate active email
          password: 'AnotherPassword@123!',
          fullName: 'Duplicate Analyst',
          role: 'provincial_analyst',
          jurisdictionProvinceId: 'lk-wp',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already exists');
    });

    it('should reject national_admin with assigned jurisdiction (Domain Invariant)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `invalid.admin.${Date.now()}@slsea.gov.lk`,
          password: 'SecurePassword@2026!',
          fullName: 'Invalid Admin',
          role: 'national_admin',
          jurisdictionProvinceId: 'lk-wp', // Forbidden for national_admin
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('National administrators cannot');
    });

    it('should reject provincial_analyst without jurisdictionProvinceId (Domain Invariant)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `invalid.analyst.${Date.now()}@slsea.gov.lk`,
          password: 'SecurePassword@2026!',
          fullName: 'Invalid Analyst',
          role: 'provincial_analyst',
          // Missing jurisdictionProvinceId
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('jurisdictionProvinceId');
    });

    it('should reject district_operator without jurisdictionDistrictId (Domain Invariant)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `invalid.operator.${Date.now()}@slsea.gov.lk`,
          password: 'SecurePassword@2026!',
          fullName: 'Invalid Operator',
          role: 'district_operator',
          // Missing jurisdictionDistrictId
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain('jurisdictionDistrictId');
    });

    it('should reject short passwords (< 8 characters)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `short.pass.${Date.now()}@slsea.gov.lk`,
          password: 'short',
          fullName: 'Short Password User',
          role: 'provincial_analyst',
          jurisdictionProvinceId: 'lk-wp',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 2. USER DIRECTORY & PAGINATION (GET /api/v1/users)
  // =========================================================================
  describe('GET /api/v1/users (List Users with Pagination & Filters)', () => {
    it('should return paginated user collection with redacted passwords', async () => {
      const res = await request(app)
        .get('/api/v1/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
      });
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);

      // Verify credentials are not leaked in any record
      for (const u of res.body.users) {
        expect(u).not.toHaveProperty('passwordHash');
        expect(u).not.toHaveProperty('password');
      }
    });

    it('should filter users by role (e.g. role=provincial_analyst)', async () => {
      const res = await request(app)
        .get('/api/v1/users?role=provincial_analyst')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const u of res.body.users) {
        expect(u.role).toBe('provincial_analyst');
      }
    });
  });

  // =========================================================================
  // 3. ATOMIC USER RETRIEVAL (GET /api/v1/users/:id)
  // =========================================================================
  describe('GET /api/v1/users/:id (Atomic User Retrieval)', () => {
    it('should retrieve a single user profile by UUID', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(adminId);
      expect(res.body.role).toBe('national_admin');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 404 RESOURCE_NOT_FOUND for non-existent user UUID', async () => {
      const res = await request(app)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 400 VALIDATION_ERROR for malformed UUID format', async () => {
      const res = await request(app)
        .get('/api/v1/users/not-a-valid-uuid')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 4. USER UPDATE & SELF-ELEVATION GUARDS (PUT /api/v1/users/:id)
  // =========================================================================
  describe('PUT /api/v1/users/:id (User Update & Guards)', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `update.target.${Date.now()}@slsea.gov.lk`,
          password: 'InitialPassword@2026!',
          fullName: 'Before Update Name',
          role: 'district_operator',
          jurisdictionDistrictId: 'dist-colombo',
        });
      targetUserId = createRes.body.id;
    });

    it('should update mutable user profile attributes successfully', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'After Update Name',
          status: 'suspended',
        });

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('After Update Name');
      expect(res.body.status).toBe('suspended');
    });

    it('should block admin self-role tampering with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'provincial_analyst', // Admin trying to modify own role
          jurisdictionProvinceId: 'lk-wp',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('modify their own administrative role');
    });

    it('should block admin self-deactivation with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'suspended', // Admin trying to suspend own account
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('suspend or deactivate their own account');
    });
  });

  // =========================================================================
  // 5. PASSWORD ROTATION (PUT /api/v1/users/:id/password)
  // =========================================================================
  describe('PUT /api/v1/users/:id/password (Admin Password Reset)', () => {
    const rotationEmail = `rotation.${Date.now()}@slsea.gov.lk`;
    let rotationUserId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: rotationEmail,
          password: 'OldPassword@2026!',
          fullName: 'Password Rotation User',
          role: 'provincial_analyst',
          jurisdictionProvinceId: 'lk-wp',
        });
      rotationUserId = createRes.body.id;
    });

    it('should reset user password and verify login with new credentials', async () => {
      const newPassword = 'NewStrongPassword@2026!';

      const resetRes = await request(app)
        .put(`/api/v1/users/${rotationUserId}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: newPassword });

      expect(resetRes.status).toBe(200);

      // Verify old password no longer works
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: rotationEmail, password: 'OldPassword@2026!' });
      expect(oldLoginRes.status).toBe(401);

      // Verify new password works immediately
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: rotationEmail, password: newPassword });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body).toHaveProperty('token');
    });
  });

  // =========================================================================
  // 6. SOFT-DELETE LIFECYCLE & LOCKOUT GUARDS (DELETE /api/v1/users/:id)
  // =========================================================================
  describe('DELETE /api/v1/users/:id (Soft-Delete & Invariant Guards)', () => {
    const deleteTestEmail = `to.delete.${Date.now()}@slsea.gov.lk`;
    let deleteUserId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: deleteTestEmail,
          password: 'Password@2026!',
          fullName: 'User To Be Soft Deleted',
          role: 'district_operator',
          jurisdictionDistrictId: 'dist-colombo',
        });
      deleteUserId = createRes.body.id;
    });

    it('should block self-deletion by administrator with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('cannot delete their own account');
    });

    it('should soft-delete user successfully setting status = deleted', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('deleted');

      // Subsequent GET must return 404
      const getRes = await request(app)
        .get(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);

      // Soft-deleted user cannot authenticate
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: deleteTestEmail, password: 'Password@2026!' });
      expect(loginRes.status).toBe(401);
    });

    it('should allow recycling the email of a soft-deleted user (Partial Unique Index)', async () => {
      // Create user with the exact same email as the deleted user
      const recycleRes = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: deleteTestEmail, // Recycled email!
          password: 'RecycledPassword@2026!',
          fullName: 'Recycled Account User',
          role: 'district_operator',
          jurisdictionDistrictId: 'dist-colombo',
        });

      expect(recycleRes.status).toBe(201);
      expect(recycleRes.body.email).toBe(deleteTestEmail);
      expect(recycleRes.body.id).not.toBe(deleteUserId);
    });
  });

  // =========================================================================
  // 7. RBAC & WRITE-READ SPLIT ENFORCEMENT
  // =========================================================================
  describe('RBAC & Write-Read Split Authorization Guards', () => {
    it('should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject provincial_analyst with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${provincialAnalystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject district_operator with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${districtOperatorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject metering devices presenting X-Device-Key with 403 FORBIDDEN (Write-Read Split)', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('X-Device-Key', 'sec_dev_inst-lk-0001_caaf80f7fae3f365')
        .send({ email: 'meter@slsea.gov.lk' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Metering devices are strictly forbidden');
    });
  });
});
