import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { forbidden, unauthenticated } from '@/lib/errors';
import { signSession, verifySession, SESSION_TTL_SECONDS } from './jwt';
import { can, isStaff, type Permission } from './rbac';

export const SESSION_COOKIE = 'yd_session';
export const GUEST_CART_COOKIE = 'yd_cart';
/**
 * First-party analytics id for a visitor who has no bag yet.
 *
 * Separate from the cart cookie because a shopper is counted from their first
 * product view, which is long before they have a cart — using the cart cookie
 * alone would count the same person differently at different stages of the
 * funnel.
 */
export const VISITOR_COOKIE = 'yd_v';

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  sessionId: string;
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/** Issues a DB-backed session and sets the signed cookie. */
export async function createSession(userId: string, email: string, role: Role): Promise<void> {
  const h = await headers();
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: h.get('user-agent')?.slice(0, 255) ?? null,
      ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64) || null,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });

  const token = await signSession({ sub: userId, sid: session.id, role, email });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
}

/** Revokes the server-side session, so the cookie is dead even if replayed. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const claims = await verifySession(token);
    if (claims?.sid) {
      await prisma.session
        .updateMany({ where: { id: claims.sid, revokedAt: null }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user. Memoised per request via React `cache`, so a
 * page that checks auth in several places still issues one query.
 *
 * A valid signature is not enough — the session row must exist, be unrevoked
 * and unexpired, and the user must still be active.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySession(token);
  if (!claims) return null;

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: { id: true, email: true, role: true, firstName: true, lastName: true, isActive: true, deletedAt: true },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const { user } = session;
  if (!user || !user.isActive || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    sessionId: session.id,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw forbidden();
  return user;
}

/** Guards an admin action behind a specific capability. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!can(user.role, permission)) {
    throw forbidden(`Your role does not allow: ${permission}`);
  }
  return user;
}
