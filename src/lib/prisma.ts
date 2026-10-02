import { PrismaClient } from '@prisma/client';

/**
 * Single Prisma instance. In dev the module graph is re-evaluated on every
 * hot reload, so the client is parked on globalThis to avoid exhausting the
 * MySQL connection pool — which matters on shared Hostinger MySQL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

/**
 * Shared Hostinger MySQL kills idle connections after 20s (`wait_timeout`),
 * far more aggressive than Prisma's connection pool expects. When a pooled
 * connection goes stale like that, the Rust query engine doesn't reconnect
 * gracefully — it panics ("timer has gone away"), which by Prisma's own
 * docs leaves that engine instance unrecoverable: a query that would
 * otherwise succeed keeps failing until the process restarts. One retry
 * clears it in practice (confirmed against production), and if it doesn't,
 * exiting lets the host's process supervisor replace this worker with a
 * fresh one rather than every request failing until someone notices.
 */
function isEnginePanic(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /panic|timer has gone away/i.test(message);
}

/** Retries `run` once on an engine panic; exits the process if the retry also panics. */
async function withPanicRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (!isEnginePanic(err)) throw err;
    console.error('[prisma] query engine panic — retrying once', err);
    try {
      return await run();
    } catch (retryErr) {
      if (isEnginePanic(retryErr)) {
        console.error('[prisma] retry also panicked — exiting so the host restarts this worker', retryErr);
        setImmediate(() => process.exit(1));
      }
      throw retryErr;
    }
  }
}

const extended = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      return withPanicRetry(() => query(args));
    },
  },
});

/**
 * `$allOperations` above covers every direct `prisma.model.method()` call,
 * but does not extend to the `tx` object inside an interactive transaction
 * (`prisma.$transaction(async (tx) => { tx.order.findUnique(...) })`) —
 * confirmed empirically against production, where a panic inside one of
 * those callbacks (used throughout order/inventory writes) passed through
 * unretried. Re-running the whole callback is safe here: every transaction
 * in this codebase re-reads its own state at the top rather than assuming
 * anything about a previous attempt, so a retry is a clean second try, not
 * a replay of stale data. Only the callback form is wrapped — the array
 * form (`$transaction([...])`) takes already-constructed query promises
 * that cannot be safely re-run, and nothing in this codebase needs it to be.
 */
const originalTransaction = extended.$transaction.bind(extended);
const transactionWithRetry = ((...args: Parameters<PrismaClient['$transaction']>) => {
  if (typeof args[0] === 'function') {
    return withPanicRetry(() => (originalTransaction as (...a: unknown[]) => Promise<unknown>)(...args));
  }
  return (originalTransaction as (...a: unknown[]) => Promise<unknown>)(...args);
}) as PrismaClient['$transaction'];

export const prisma = new Proxy(extended, {
  get(target, prop, receiver) {
    if (prop === '$transaction') return transactionWithRetry;
    return Reflect.get(target, prop, receiver);
  },
}) as unknown as PrismaClient;
