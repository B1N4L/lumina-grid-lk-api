import { Request, Response } from 'express';
import { createHash } from 'crypto';

/**
 * Sends a JSON response with an ETag header.
 * If the request contains a matching If-None-Match header, returns 304 Not Modified.
 */
export function sendWithETag<T>(req: Request, res: Response, data: T): void {
  const jsonString = JSON.stringify(data);
  const etag = `"${createHash('md5').update(jsonString).digest('hex')}"`;

  res.setHeader('ETag', etag);

  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}` || ifNoneMatch === '*')) {
    res.status(304).end();
    return;
  }

  res.status(200).json(data);
}
