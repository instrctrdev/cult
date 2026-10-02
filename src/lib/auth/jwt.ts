import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Role } from '@prisma/client';

/** Claims carried in the session cookie. Deliberately minimal. */
export interface SessionClaims extends JWTPayload {
  sub: string;
  sid: string;
  role: Role;
  email: string;
}

const ISSUER = 'cult';
const AUDIENCE = 'cult-web';

function secretKey(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEXTAUTH_SECRET is missing or too short (min 32 chars)');
  }
  return new TextEncoder().encode(secret);
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function signSession(claims: Omit<SessionClaims, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verifies signature, issuer, audience and expiry. Edge-runtime safe, which is
 * what lets middleware gate /admin without touching the database.
 */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.sid !== 'string') return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
