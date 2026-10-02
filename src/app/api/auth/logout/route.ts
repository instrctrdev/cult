import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { destroySession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** Revokes the server-side session, so the cookie is useless even if copied. */
export const POST = withErrorHandling(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
