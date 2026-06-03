export class HttpException extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'http_error',
    public readonly safeDetails?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function forbidden(message = 'Forbidden') {
  return new HttpException(403, message, 'forbidden');
}

export function unauthorized(message = 'Unauthorized') {
  return new HttpException(401, message, 'unauthorized');
}

export function notFound(message = 'Not found') {
  return new HttpException(404, message, 'not_found');
}

export function rateLimited(message = 'Rate limit exceeded') {
  return new HttpException(429, message, 'rate_limited');
}

export function validationFailed(details?: Record<string, unknown>) {
  return new HttpException(400, 'Invalid request', 'validation_failed', details);
}
