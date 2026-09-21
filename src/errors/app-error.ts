import { ErrorDetail } from '../types/error.types.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_SERVER_ERROR',
    details: ErrorDetail[] = [],
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Requested resource not found', details: ErrorDetail[] = []) {
    super(message, 404, 'RESOURCE_NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details: ErrorDetail[] = []) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details: ErrorDetail[] = []) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', details: ErrorDetail[] = []) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', details: ErrorDetail[] = []) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details: ErrorDetail[] = []) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class NotAcceptableError extends AppError {
  constructor(
    message: string = 'The requested representation format is not supported',
    details: ErrorDetail[] = []
  ) {
    super(message, 406, 'NOT_ACCEPTABLE', details);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(message: string = 'Precondition failed', details: ErrorDetail[] = []) {
    super(message, 412, 'PRECONDITION_FAILED', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'An unexpected server error occurred', details: ErrorDetail[] = []) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details, false);
  }
}
