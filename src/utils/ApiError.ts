/**
 * Typed application error carrying an HTTP status and a stable machine code
 * that the frontend maps through `frontend/constants/errors.ts`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Your role is not permitted to perform this action.'): ApiError {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(code: string, message: string): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(code: string, message: string, details?: unknown): ApiError {
    return new ApiError(422, code, message, details);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
