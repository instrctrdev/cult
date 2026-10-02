/**
 * Creates or promotes an admin account.
 *
 *   npm run admin:create -- --email admin@your-cult-domain.example --password '…' --role SUPER_ADMIN
 *
 * Passwords are never defaulted here — an admin without an explicitly chosen
 * password would be a standing security hole.
 */
import './load-env';
import { createInterface } from 'readline/promises';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const email = (arg('email') ?? (await rl.question('Email: '))).trim().toLowerCase();
  const password = arg('password') ?? (await rl.question('Password (min 8 chars, letters + numbers): '));
  const roleInput = (arg('role') ?? 'ADMIN').toUpperCase();
  rl.close();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('That is not a valid email address.');
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Password must be at least 8 characters and include a letter and a number.');
  }
  if (!['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(roleInput)) {
    throw new Error('Role must be STAFF, ADMIN or SUPER_ADMIN.');
  }
  const role = roleInput as Role;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 12), role, isActive: true, deletedAt: null },
    });
    // Force re-login everywhere after a credential change.
    await prisma.session.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } });
    console.log(`✅ Updated ${email} → ${role} (existing sessions revoked)`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role,
        emailVerifiedAt: new Date(),
        wishlist: { create: {} },
      },
    });
    console.log(`✅ Created ${email} as ${role}`);
  }
}

main()
  .catch((e) => {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
