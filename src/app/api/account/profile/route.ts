import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { requireUser } from '@/lib/auth/session';
import { CustomerService } from '@/services/customer.service';
import { profileSchema, changePasswordSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const body = profileSchema.parse(await req.json());
  const updated = await CustomerService.updateProfile(user.id, body);
  return NextResponse.json(updated);
});

/** POST — change password. Requires the current password. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const body = changePasswordSchema.parse(await req.json());
  await CustomerService.changePassword(user.id, body.currentPassword, body.newPassword);
  return NextResponse.json({ ok: true });
});
