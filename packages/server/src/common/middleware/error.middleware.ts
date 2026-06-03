import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { HttpException } from '../http/http-exception';

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof HttpException) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.safeDetails
        }
      },
      error.status as ContentfulStatusCode
    );
  }

  console.error('server_error', {
    message: error.message,
    stack: error.stack
  });

  return c.json(
    {
      error: {
        code: 'server_error',
        message: 'Internal server error'
      }
    },
    500
  );
};
