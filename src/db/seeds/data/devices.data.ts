import { knownDeviceCredentials, DeviceCredentialRecord } from '../generators/installations-generator.js';

export { DeviceCredentialRecord };

/**
 * Helper to get a ready-to-use device test credential for testing write endpoints
 */
export function getTestDeviceCredential(index: number = 0): DeviceCredentialRecord {
  if (knownDeviceCredentials.length === 0) {
    // Fallback deterministic sample for installation 0001
    const instId = 'inst-lk-0001';
    const meterId = 'MTR-SLSEA-0001';
    return {
      installationId: instId,
      meterId,
      rawApiKey: 'sec_dev_inst-lk-0001_d41d8cd98f00b204',
      apiKeyHash: '965f3a0937a09289da262b9f33e7ad6b38c29b6d8595cbcf90e4f24c30c7e2f5',
    };
  }

  return knownDeviceCredentials[index % knownDeviceCredentials.length]!;
}
