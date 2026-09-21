import { eq } from 'drizzle-orm';
import { db, users } from '../db/index.js';
import { comparePassword } from '../utils/crypto.js';
import { signUserToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { LoginInput } from '../schemas/auth.schema.js';
import { UserRole, UserTokenPayload } from '../types/auth.types.js';

export interface LoginResult {
  token: string;
  tokenType: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    jurisdictionProvinceId: string | null;
    jurisdictionDistrictId: string | null;
  };
}

export class AuthService {
  /**
   * Authenticate SLSEA personnel with email and password
   * Returns signed JWT bearing user identity, role, and jurisdiction scope claims
   */
  static async login(input: LoginInput): Promise<LoginResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: UserTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
      jurisdictionProvinceId: user.jurisdictionProvinceId,
      jurisdictionDistrictId: user.jurisdictionDistrictId,
    };

    const token = signUserToken(payload);

    return {
      token,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        jurisdictionProvinceId: user.jurisdictionProvinceId,
        jurisdictionDistrictId: user.jurisdictionDistrictId,
      },
    };
  }
}
