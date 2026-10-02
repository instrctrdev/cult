import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandling } from '@/lib/errors';
import { SearchService } from '@/services/search.service';
import { parseQuery, searchSchema } from '@/lib/validation';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** GET /api/search?q=…&limit=… — typeahead suggestions. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  enforceRateLimit({ key: 'search', identifier: clientIp(req.headers), limit: 120, windowSeconds: 60 });

  const { q, limit } = parseQuery(searchSchema, req.nextUrl.searchParams);
  const result = await SearchService.suggest(q, limit);

  // Logged after the response is shaped so it never delays the reply.
  void SearchService.log(q, result.total);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
  });
});
