import crypto from 'node:crypto';
import { NewSolarInstallation } from '../../schema/solar-installations.js';
import { gridSubstationsData } from '../data/grid-substations.data.js';

export interface DeviceCredentialRecord {
  installationId: string;
  meterId: string;
  rawApiKey: string;
  apiKeyHash: string;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export const knownDeviceCredentials: DeviceCredentialRecord[] = [];

export function generateInstallations(): NewSolarInstallation[] {
  const installations: NewSolarInstallation[] = [];
  knownDeviceCredentials.length = 0; // Reset

  const capacities = ['5.00', '10.00', '15.00', '20.00', '35.00', '50.00', '75.00', '100.00'];
  const inverterBrands = ['HUAWEI-SUN2000', 'SMA-SUNNY-TRIPOWER', 'FRONIUS-SYMO', 'GROWATT-MIN', 'SOLIS-3P'];

  // Generate 8 installations per substation (8 * 27 = 216 installations >= 200 requirement)
  let globalIndex = 1;

  for (const substation of gridSubstationsData) {
    const installationsPerSubstation = 8;

    for (let i = 1; i <= installationsPerSubstation; i++) {
      const padIndex = String(globalIndex).padStart(4, '0');
      const instId = `inst-lk-${padIndex}`;
      const meterId = `MTR-SLSEA-${padIndex}`;
      const inverterBrand = inverterBrands[(globalIndex - 1) % inverterBrands.length]!;
      const inverterId = `${inverterBrand}-${String(i).padStart(2, '0')}`;
      const capacity = capacities[(globalIndex - 1) % capacities.length]!;

      // Create a deterministic API key for the installation
      const rawApiKey = `sec_dev_${instId}_${crypto.createHash('md5').update(meterId).digest('hex').substring(0, 16)}`;
      const apiKeyHash = hashApiKey(rawApiKey);

      knownDeviceCredentials.push({
        installationId: instId,
        meterId,
        rawApiKey,
        apiKeyHash,
      });

      const year = 2023 + (globalIndex % 3);
      const month = String((globalIndex % 12) + 1).padStart(2, '0');
      const day = String((globalIndex % 28) + 1).padStart(2, '0');
      const commissionedDate = `${year}-${month}-${day}`;

      // 95% active, 5% maintenance
      const status = globalIndex % 20 === 0 ? 'maintenance' : 'active';

      installations.push({
        id: instId,
        substationId: substation.id,
        name: `Solar Asset ${substation.name.replace(' Grid Substation', '')} #${i}`,
        meterId,
        inverterId,
        installedCapacityKw: capacity,
        commissionedDate,
        status,
        apiKeyHash,
      });

      globalIndex++;
    }
  }

  return installations;
}
