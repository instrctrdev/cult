import bcrypt from 'bcryptjs';

/**
 * 12 rounds is the practical ceiling on Hostinger's shared CPU — high enough
 * to be costly to attack, low enough that login stays under ~250ms.
 */
const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Constant-ish work even when the account does not exist, so response timing
 * cannot be used to enumerate registered emails.
 */
export async function dummyVerify(): Promise<void> {
  await bcrypt.compare('not-a-real-password', '$2a$12$0000000000000000000000000000000000000000000000000000');
}
