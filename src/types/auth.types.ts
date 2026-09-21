export type UserRole = 'national_admin' | 'provincial_analyst' | 'district_operator';

export interface UserTokenPayload {
  sub: string; // user id (UUID)
  email: string;
  role: UserRole;
  fullName: string;
  jurisdictionProvinceId: string | null;
  jurisdictionDistrictId: string | null;
}

export interface AuthenticatedDevice {
  installationId: string;
  meterId: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      device?: AuthenticatedDevice;
    }
  }
}
