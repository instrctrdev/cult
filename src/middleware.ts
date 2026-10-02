import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';

/**
 * Edge gate for /admin.
 *
 * This is a fast first check only — it verifies the cookie's signature, which
 * is all the Edge runtime can do without a database. The authoritative check
 * (session not revoked, user still active, role still sufficient) runs in the
 * admin layout and in `requirePermission` on every mutating route. A stolen or
 * stale cookie that passes here still fails there.
 */
const STAFF_ROLES = new Set(['STAFF', 'ADMIN', 'SUPER_ADMIN']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page must stay reachable or an unauthenticated admin is stuck.
  if (pathname === '/admin/login') return NextResponse.next();

  const token = req.cookies.get('yd_session')?.value;
  const claims = token ? await verifySession(token) : null;

  if (!claims || !STAFF_ROLES.has(String(claims.role))) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Admin screens must never be cached by a proxy or the browser.
  res.headers.set('Cache-Control', 'no-store, must-revalidate');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = {
  matcher: ['/admin/:path*'],
};
