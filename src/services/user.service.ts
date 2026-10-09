import { eq, and, ne, sql } from 'drizzle-orm';
import { db, users, provinces, districts } from '../db/index.js';
import { hashPassword } from '../utils/crypto.js';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../errors/app-error.js';
import {
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  UserQueryInput,
} from '../schemas/user.schema.js';
import { UserRole, UserStatus } from '../types/auth.types.js';

export interface SanitizedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  jurisdictionProvinceId: string | null;
  jurisdictionDistrictId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedUsersResult {
  users: SanitizedUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function toSanitizedUser(raw: typeof users.$inferSelect): SanitizedUser {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.fullName,
    role: raw.role as UserRole,
    status: raw.status as UserStatus,
    jurisdictionProvinceId: raw.jurisdictionProvinceId,
    jurisdictionDistrictId: raw.jurisdictionDistrictId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export class UserService {
  /**
   * Create a new SLSEA user under National Admin authority
   * Enforces partial unique email index semantics (409 Conflict) and domain invariants
   */
  static async createUser(input: CreateUserInput): Promise<SanitizedUser> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check for duplicate active email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), ne(users.status, 'deleted')))
      .limit(1);

    if (existingUser) {
      throw new ConflictError(`An active user with email '${normalizedEmail}' already exists`);
    }

    // Validate foreign key references if jurisdiction IDs provided
    if (input.jurisdictionProvinceId) {
      const [prov] = await db
        .select({ id: provinces.id })
        .from(provinces)
        .where(eq(provinces.id, input.jurisdictionProvinceId))
        .limit(1);

      if (!prov) {
        throw new NotFoundError(
          `Jurisdiction province '${input.jurisdictionProvinceId}' was not found`
        );
      }
    }

    if (input.jurisdictionDistrictId) {
      const [dist] = await db
        .select({ id: districts.id })
        .from(districts)
        .where(eq(districts.id, input.jurisdictionDistrictId))
        .limit(1);

      if (!dist) {
        throw new NotFoundError(
          `Jurisdiction district '${input.jurisdictionDistrictId}' was not found`
        );
      }
    }

    // Hash secret using bcrypt with 10 salt rounds
    const passwordHash = await hashPassword(input.password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        fullName: input.fullName.trim(),
        role: input.role,
        status: 'active',
        jurisdictionProvinceId: input.jurisdictionProvinceId || null,
        jurisdictionDistrictId: input.jurisdictionDistrictId || null,
      })
      .returning();

    return toSanitizedUser(newUser!);
  }

  /**
   * List users with pagination and filtering across role, status, and jurisdiction
   * Redacts all sensitive credentials from returned payloads
   */
  static async listUsers(query: UserQueryInput): Promise<PaginatedUsersResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }

    if (query.status) {
      conditions.push(eq(users.status, query.status));
    } else {
      // Default: exclude soft-deleted users unless explicitly requested
      conditions.push(ne(users.status, 'deleted'));
    }

    if (query.jurisdictionProvinceId) {
      conditions.push(eq(users.jurisdictionProvinceId, query.jurisdictionProvinceId));
    }

    if (query.jurisdictionDistrictId) {
      conditions.push(eq(users.jurisdictionDistrictId, query.jurisdictionDistrictId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(whereClause),
      db
        .select()
        .from(users)
        .where(whereClause)
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users: rows.map(toSanitizedUser),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single user profile by UUID (excluding passwordHash)
   * Returns 404 if nonexistent or soft-deleted
   */
  static async getUserById(id: string): Promise<SanitizedUser> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), ne(users.status, 'deleted')))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User with identifier '${id}' was not found`);
    }

    return toSanitizedUser(user);
  }

  /**
   * Update mutable profile attributes with self-elevation and role-tampering guards
   */
  static async updateUser(
    id: string,
    input: UpdateUserInput,
    currentAdminId: string
  ): Promise<SanitizedUser> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), ne(users.status, 'deleted')))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User with identifier '${id}' was not found`);
    }

    // Safety guard: Administrators cannot alter their own role or deactivate own account
    if (id === currentAdminId) {
      if (input.role && input.role !== user.role) {
        throw new ForbiddenError('Administrators cannot modify their own administrative role');
      }
      if (input.status && input.status !== 'active') {
        throw new ForbiddenError('Administrators cannot suspend or deactivate their own account');
      }
    }

    const targetRole = input.role || (user.role as UserRole);

    // Validate foreign keys if jurisdiction IDs provided
    if (input.jurisdictionProvinceId) {
      const [prov] = await db
        .select({ id: provinces.id })
        .from(provinces)
        .where(eq(provinces.id, input.jurisdictionProvinceId))
        .limit(1);

      if (!prov) {
        throw new NotFoundError(
          `Jurisdiction province '${input.jurisdictionProvinceId}' was not found`
        );
      }
    }

    if (input.jurisdictionDistrictId) {
      const [dist] = await db
        .select({ id: districts.id })
        .from(districts)
        .where(eq(districts.id, input.jurisdictionDistrictId))
        .limit(1);

      if (!dist) {
        throw new NotFoundError(
          `Jurisdiction district '${input.jurisdictionDistrictId}' was not found`
        );
      }
    }

    const updatePayload: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.fullName !== undefined) {
      updatePayload.fullName = input.fullName.trim();
    }

    if (input.status !== undefined) {
      updatePayload.status = input.status;
    }

    if (input.role !== undefined) {
      updatePayload.role = input.role;
    }

    if (targetRole === 'national_admin') {
      updatePayload.jurisdictionProvinceId = null;
      updatePayload.jurisdictionDistrictId = null;
    } else {
      if (input.jurisdictionProvinceId !== undefined) {
        updatePayload.jurisdictionProvinceId = input.jurisdictionProvinceId;
      }
      if (input.jurisdictionDistrictId !== undefined) {
        updatePayload.jurisdictionDistrictId = input.jurisdictionDistrictId;
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updatePayload)
      .where(eq(users.id, id))
      .returning();

    return toSanitizedUser(updatedUser!);
  }

  /**
   * Reset user password with bcrypt hashing (cost 10)
   */
  static async resetPassword(id: string, input: ResetPasswordInput): Promise<void> {
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.id, id), ne(users.status, 'deleted')))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User with identifier '${id}' was not found`);
    }

    const passwordHash = await hashPassword(input.password);

    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Soft-delete user with self-deletion and last-admin lockout guards
   */
  static async deleteUser(
    id: string,
    currentAdminId: string
  ): Promise<{ id: string; status: string; message: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), ne(users.status, 'deleted')))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User with identifier '${id}' was not found`);
    }

    // Safety Guard 1: Administrator cannot delete themselves
    if (id === currentAdminId) {
      throw new ForbiddenError('Administrators cannot delete their own account');
    }

    // Safety Guard 2: Cannot delete the last remaining active national_admin
    if (user.role === 'national_admin') {
      const [adminCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, 'national_admin'), eq(users.status, 'active')));

      const activeAdminCount = adminCountResult?.count ?? 0;
      if (activeAdminCount <= 1) {
        throw new ForbiddenError('Cannot delete the last remaining active national administrator');
      }
    }

    await db
      .update(users)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return {
      id,
      status: 'deleted',
      message: `User '${user.email}' has been soft-deleted successfully`,
    };
  }
}
