'use client';

import * as React from 'react';
import Image from 'next/image';
import { Ruler } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

/**
 * Size guide.
 *
 * A garment-specific chart (uploaded per product in Admin → Products, since
 * a shirt and a kurta measure up differently) takes priority; otherwise this
 * falls back to CULT's default chart — brand size against chest, shoulder,
 * front length and sleeve length in inches, ± 0.5" tolerance from manual
 * measurement. The fit language below it explains the cut, not the numbers,
 * so both stay useful together.
 */
export function SizeGuide({ fit, chartImage }: { fit?: string | null; chartImage?: string | null }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide2 text-muted underline underline-offset-4 transition-colors hover:text-ink"
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden />
          Size guide
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" title="Size guide" className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-md lg:rounded-none">
        <div className="space-y-6 pb-4">
          <Image
            src={chartImage || '/images/brand/size-chart.webp'}
            alt={
              chartImage
                ? 'Size chart for this style — brand size against body measurements in inches'
                : 'CULT size chart — brand size against chest, shoulder, front length and sleeve length in inches, ± 0.5 inch tolerance'
            }
            width={1200}
            height={800}
            sizes="(min-width:1024px) 448px, 100vw"
            className="h-auto w-full rounded-md bg-surface"
          />

          {fit && (
            <div>
              <h3 className="mb-1.5 font-serif text-base">This style</h3>
              <p className="text-sm text-muted">
                Cut as a <strong className="text-ink">{fit.toLowerCase()}</strong>.
              </p>
            </div>
          )}

          <div>
            <h3 className="mb-2 font-serif text-base">How our fits run</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-ink">Regular fit</dt>
                <dd className="text-muted">Classic straight cut — true to size.</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Boxy fit</dt>
                <dd className="text-muted">Relaxed through the body with a shorter, squarer length.</dd>
              </div>
            </dl>
          </div>

          <p className="rounded-md bg-surface p-3 text-xs text-muted">
            Measurements may vary by ± 0.5 inch. If you are between sizes, size up for a boxy fit
            or stay true to size for a regular fit.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
