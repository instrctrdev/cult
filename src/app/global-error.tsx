'use client';

/** Last-resort boundary — replaces the whole document, so it ships its own html/body. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, background: '#faf9f7', color: '#1a1a1a', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '1.5rem', textAlign: 'center' }}>
          <div>
            <p style={{ letterSpacing: '.18em', fontWeight: 700 }}>CULT</p>
            <h1 style={{ marginTop: '2rem', fontSize: '1.5rem', fontWeight: 500 }}>Something went wrong</h1>
            <p style={{ marginTop: '.5rem', color: 'rgba(26,26,26,.5)', fontSize: '.875rem' }}>
              Please refresh the page or try again shortly.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: '2rem', height: '3rem', padding: '0 1.75rem', border: 0, borderRadius: '.375rem',
                background: '#1a1a1a', color: '#faf9f7', textTransform: 'uppercase',
                letterSpacing: '.18em', fontSize: '.75rem', cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {error.digest && (
              <p style={{ marginTop: '2rem', fontSize: '.6875rem', color: 'rgba(26,26,26,.28)' }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
