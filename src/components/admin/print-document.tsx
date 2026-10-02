'use client';

import * as React from 'react';
import { Printer, X } from 'lucide-react';

/**
 * Chrome around a printable document.
 *
 * "Download" here is the browser's own print dialog with Save as PDF, rather
 * than a PDF generated on the server. It keeps the document identical to what
 * is on screen, needs no rendering dependency, and lets staff send it straight
 * to a label printer — which is what a packing slip is usually for.
 *
 * Everything in `.print-hide` disappears from the printed page, so the toolbar
 * never lands on the paper.
 */
export function PrintDocument({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const previous = document.title;
    // The browser offers the document title as the PDF filename.
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);

  return (
    <div className="min-h-dvh bg-ink/5 py-6 print:bg-white print:py-0">
      <div className="print-hide mx-auto mb-4 flex max-w-[820px] items-center justify-between px-4">
        <button
          type="button"
          onClick={() => window.close()}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
          Close
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-6 text-xs font-medium uppercase tracking-luxe text-bg transition-colors hover:bg-ink/90"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Download / Print
        </button>
      </div>

      <div className="mx-auto max-w-[820px] bg-white px-4">
        <div className="border border-line bg-white p-8 text-ink shadow-sm print:border-0 print:p-0 print:shadow-none">
          {children}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .print-hide { display: none !important; }
          @page { margin: 14mm; size: A4; }
          body { background: #fff; }
        }
      `}</style>
    </div>
  );
}
