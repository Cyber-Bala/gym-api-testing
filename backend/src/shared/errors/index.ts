export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict detected', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class CapacityExceededError extends AppError {
  constructor(message = 'Slot capacity has been reached', details?: unknown) {
    super(message, 409, 'CAPACITY_EXCEEDED', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'A required service is not running', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}
