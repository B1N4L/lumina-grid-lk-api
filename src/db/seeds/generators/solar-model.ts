/**
 * Solar Diurnal Curve Mathematical Model
 *
 * Simulates realistic solar photovoltaic generation based on Sri Lanka's tropical
 * solar irradiance patterns:
 * - Sunrise ~06:00, Peak solar noon ~12:00-12:30, Sunset ~18:00
 * - Night time (18:00 - 06:00): Strictly 0.000 kW
 * - Realistic diurnal sinusoidal curve with weather/cloud variance
 * - Nominal Sri Lanka grid specifications: 230V +/- 3V, 50.00Hz +/- 0.08Hz
 */

export interface SolarTelemetryReading {
  timestamp: Date;
  powerKw: number;
  energyKwh: number;
  voltage: number;
  currentA: number;
  frequencyHz: number;
}

export function calculateDiurnalPower(
  installedCapacityKw: number,
  hourFraction: number, // 0.00 to 24.00 (e.g. 12.25 for 12:15)
  weatherFactor: number = 1.0
): number {
  // Between 18:00 and 06:00, solar generation is strictly 0
  if (hourFraction < 6.0 || hourFraction > 18.0) {
    return 0.0;
  }

  // Normalized time across the 12-hour daylight window [0 to 1]
  const daylightProgress = (hourFraction - 6.0) / 12.0;

  // Sinusoidal bell curve peaking at midday (sin(pi / 2) = 1.0)
  const idealOutput = Math.sin(daylightProgress * Math.PI);

  // Apply installed peak capacity, weather factor, and ensure bounds
  const generatedKw = installedCapacityKw * idealOutput * weatherFactor;

  return Math.max(0, Math.min(installedCapacityKw * 1.05, generatedKw));
}

export function generateReadingTelemetry(
  installedCapacityKw: number,
  timestamp: Date,
  previousCumulativeEnergyKwh: number,
  weatherVariance: number
): SolarTelemetryReading {
  const hours = timestamp.getHours();
  const minutes = timestamp.getMinutes();
  const hourFraction = hours + minutes / 60.0;

  const powerKw = calculateDiurnalPower(installedCapacityKw, hourFraction, weatherVariance);

  // 15-minute interval = 0.25 hour energy increment
  const intervalEnergyKwh = powerKw * 0.25;
  const energyKwh = previousCumulativeEnergyKwh + intervalEnergyKwh;

  // AC interface grid characteristics
  // Slight voltage drop when generating at peak due to local impedance, nominal 230V
  const voltageBase = 230.0;
  const voltageNoise = (Math.sin(timestamp.getTime() / 3600000) * 2.5) + (Math.random() * 1.5 - 0.75);
  const voltage = +(voltageBase + voltageNoise).toFixed(2);

  // Current I = (P * 1000) / (V * powerFactor) where powerFactor ~0.98
  const currentA = powerKw > 0 ? +((powerKw * 1000) / (voltage * 0.98)).toFixed(2) : 0.0;

  // Sri Lanka CEB grid frequency ~50.00 Hz with tiny grid swings
  const freqNoise = Math.sin(timestamp.getTime() / 600000) * 0.04 + (Math.random() * 0.02 - 0.01);
  const frequencyHz = +(50.0 + freqNoise).toFixed(2);

  return {
    timestamp,
    powerKw: +powerKw.toFixed(3),
    energyKwh: +energyKwh.toFixed(3),
    voltage,
    currentA,
    frequencyHz,
  };
}
