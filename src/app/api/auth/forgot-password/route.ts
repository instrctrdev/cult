import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { forgotPasswordSchema } from '@/lib/validation';
import { CustomerService } from '@/services/customer.service';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { publicEnv, isProd } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Always returns the same response whether or not the account exists — the
 * endpoint must not reveal which emails are registered.
 *
 * NOTE: no transactional email provider is configured (the brief rules out
 * extra paid services). The reset link is written to the server log so it can
 * be delivered manually, and the token is returned only in development.
 * Wiring an SMTP sender is a single change in this handler.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'forgot', identifier: clientIp(req.headers), limit: 5, windowSeconds: 3600 });

  const { email } = forgotPasswordSchema.parse(await req.json());
  const token = await CustomerService.createPasswordResetToken(email);

  if (token) {
    const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/account/reset-password?token=${token}`;
    console.info(`[auth] password reset link for ${email}: ${link}`);
  }

  return NextResponse.json({
    ok: true,
    message: 'If that email has an account, a reset link is on its way.',
    ...(isProd ? {} : { devResetToken: token }),
  });
});
