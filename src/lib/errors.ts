import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isProd } from './env';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OUT_OF_STOCK'
  | 'COUPON_INVALID'
  | 'PAYMENT_ERROR'
  | 'SHIPPING_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  COUPON_INVALID: 422,
  PAYMENT_ERROR: 402,
  SHIPPING_ERROR: 502,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** Every thrown error the API surfaces to a client is one of these. */
export class AppError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
  get status() {
    return STATUS[this.code];
  }
}

export const badRequest = (m: string, d?: unknown) => new AppError('BAD_REQUEST', m, d);
export const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m);
export const unauthenticated = (m = 'Please sign in to continue') => new AppError('UNAUTHENTICATED', m);
export const forbidden = (m = 'You do not have access to this resource') => new AppError('FORBIDDEN', m);
export const conflict = (m: string, d?: unknown) => new AppError('CONFLICT', m, d);
export const outOfStock = (m: string, d?: unknown) => new AppError('OUT_OF_STOCK', m, d);

/** Uniform envelope: { error: { code, message, details? } } */
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export function toErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR' as const,
          message: 'Some of the details provided are not valid.',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
      { status: 422 },
    );
  }

  // Anything unrecognised is a bug. Log it fully, tell the user nothing.
  console.error('[api] unhandled error', err);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'Something went wrong on our end. Please try again.',
        details: isProd ? undefined : String(err instanceof Error ? err.stack : err),
      },
    },
    { status: 500 },
  );
}

/** Wraps a route handler so no handler ever leaks a stack trace. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
