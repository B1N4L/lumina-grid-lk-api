import { CanonicalReadingsQuery } from '../schemas/query.schema.js';

export interface HateoasLink {
  href: string;
}

export interface HateoasLinks {
  self: HateoasLink;
  first: HateoasLink;
  prev: HateoasLink | null;
  next: HateoasLink | null;
  last: HateoasLink;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  total_count: number;
  total_pages: number;
}

export interface PaginatedEnvelope<T> {
  data: T[];
  pagination: PaginationMetadata;
  _links: HateoasLinks;
}

/**
 * Builds RFC-compliant HATEOAS navigation link relations (self, first, prev, next, last)
 * preserving all active query parameters and filter boundaries.
 */
export function buildHateoasLinks(
  basePath: string,
  query: CanonicalReadingsQuery,
  totalPages: number
): HateoasLinks {
  const effectiveLastPage = Math.max(1, totalPages);

  const createPageUrl = (targetPage: number): string => {
    const params = new URLSearchParams();
    params.set('page', String(targetPage));
    params.set('limit', String(query.limit));

    if (query.from) {
      params.set('from', query.from);
    }
    if (query.to) {
      params.set('to', query.to);
    }
    if (query.minPowerKw !== undefined) {
      params.set('min_power_kw', String(query.minPowerKw));
    }
    if (query.maxPowerKw !== undefined) {
      params.set('max_power_kw', String(query.maxPowerKw));
    }
    if (query.sortBy && query.sortBy !== 'timestamp') {
      params.set('sort_by', query.sortBy);
    }
    if (query.order && query.order !== 'desc') {
      params.set('order', query.order);
    }

    return `${basePath}?${params.toString()}`;
  };

  const currentPage = query.page;

  return {
    self: { href: createPageUrl(currentPage) },
    first: { href: createPageUrl(1) },
    prev: currentPage > 1 ? { href: createPageUrl(currentPage - 1) } : null,
    next: currentPage < effectiveLastPage ? { href: createPageUrl(currentPage + 1) } : null,
    last: { href: createPageUrl(effectiveLastPage) },
  };
}

/**
 * Wraps collection items and pagination metadata into a unified RFC-compliant HATEOAS envelope.
 */
export function createPaginatedEnvelope<T>(
  items: T[],
  page: number,
  limit: number,
  totalCount: number,
  totalPages: number,
  links: HateoasLinks
): PaginatedEnvelope<T> {
  return {
    data: items,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      total_count: totalCount,
      total_pages: totalPages,
    },
    _links: links,
  };
}
