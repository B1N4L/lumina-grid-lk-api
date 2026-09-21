import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { ReadingService } from '../services/reading.service.js';

export const ingestReading = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const installationId = req.params.installationId as string;
  const deviceCapacityKw = req.device?.installedCapacityKw;

  const { reading, isDuplicate } = await ReadingService.ingestReading(
    installationId,
    req.body,
    deviceCapacityKw
  );

  // REST protocol requirement: Location header pointing to newly created reading
  res.setHeader('Location', `/api/v1/installations/${installationId}/readings/${reading.id}`);

  if (isDuplicate) {
    res.setHeader('X-Idempotent-Replay', 'true');
    res.status(200).json(reading);
    return;
  }

  res.status(201).json(reading);
});
