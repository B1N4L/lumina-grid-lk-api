export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details: ErrorDetail[];
  timestamp: string;
  path?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}
