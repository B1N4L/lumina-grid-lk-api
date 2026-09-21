import bcrypt from 'bcryptjs';
import { NewUser } from '../../schema/users.js';

export const DEFAULT_PASSWORD_PLAIN = 'Slsea@2026!';

// Pre-computed bcrypt hash for 'Slsea@2026!' with 10 salt rounds to avoid CPU bottleneck during seeding
export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD_PLAIN, 10);

export const defaultUsersData: NewUser[] = [
  // 1. National Administrator (Full nationwide read access)
  {
    email: 'admin@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'National Grid Controller',
    role: 'national_admin',
    jurisdictionProvinceId: null,
    jurisdictionDistrictId: null,
  },

  // 2. Provincial Analysts (Scoped to specific provinces)
  {
    email: 'analyst.western@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Western Province Lead Analyst',
    role: 'provincial_analyst',
    jurisdictionProvinceId: 'lk-wp',
    jurisdictionDistrictId: null,
  },
  {
    email: 'analyst.central@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Central Province Lead Analyst',
    role: 'provincial_analyst',
    jurisdictionProvinceId: 'lk-cp',
    jurisdictionDistrictId: null,
  },
  {
    email: 'analyst.southern@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Southern Province Lead Analyst',
    role: 'provincial_analyst',
    jurisdictionProvinceId: 'lk-sp',
    jurisdictionDistrictId: null,
  },

  // 3. District Operators (Scoped to specific districts)
  {
    email: 'operator.colombo@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Colombo District Grid Operator',
    role: 'district_operator',
    jurisdictionProvinceId: 'lk-wp',
    jurisdictionDistrictId: 'dist-colombo',
  },
  {
    email: 'operator.kandy@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Kandy District Grid Operator',
    role: 'district_operator',
    jurisdictionProvinceId: 'lk-cp',
    jurisdictionDistrictId: 'dist-kandy',
  },
  {
    email: 'operator.galle@slsea.gov.lk',
    passwordHash: DEFAULT_PASSWORD_HASH,
    fullName: 'Galle District Grid Operator',
    role: 'district_operator',
    jurisdictionProvinceId: 'lk-sp',
    jurisdictionDistrictId: 'dist-galle',
  },
];
