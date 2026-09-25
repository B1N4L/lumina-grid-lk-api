import { Request, Response } from 'express';
import { createHash } from 'crypto';

export interface ConditionalOptions {
  lastModified?: Date | null;
}

/**
 * Evaluates HTTP conditional caching headers (If-None-Match and If-Modified-Since)
 * according to RFC 7232 / RFC 9110 specifications.
 *
 * Sets ETag (strong SHA-256 hash) and Last-Modified headers.
 * If data has not modified, terminates response with 304 Not Modified and empty body.
 * Otherwise, sends 200 OK with the JSON payload.
 */
export function sendConditionalResponse<T>(
  req: Request,
  res: Response,
  data: T,
  options?: ConditionalOptions
): void {
  const jsonString = JSON.stringify(data);
  const etag = `"${createHash('sha256').update(jsonString).digest('hex')}"`;

  res.setHeader('ETag', etag);

  if (options?.lastModified) {
    const lastModifiedHeader = new Date(options.lastModified).toUTCString();
    res.setHeader('Last-Modified', lastModifiedHeader);
  }

  // 1. Evaluate If-None-Match (has precedence over If-Modified-Since per RFC 7232)
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch) {
    const tokens = ifNoneMatch.split(',').map((t) => t.trim());
    const matchesEtag = tokens.some(
      (token) => token === etag || token === `W/${etag}` || token === '*'
    );

    if (matchesEtag) {
      res.status(304).end();
      return;
    }
  }

  // 2. Evaluate If-Modified-Since if If-None-Match was not present
  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince && options?.lastModified && !ifNoneMatch) {
    const clientModifiedTime = new Date(ifModifiedSince).getTime();
    const serverModifiedTime = new Date(options.lastModified).getTime();

    // If client's timestamp is >= server's last modified timestamp (ignoring sub-second differences)
    if (
      !isNaN(clientModifiedTime) &&
      Math.floor(serverModifiedTime / 1000) <= Math.floor(clientModifiedTime / 1000)
    ) {
      res.status(304).end();
      return;
    }
  }

  res.status(200).json(data);
}
