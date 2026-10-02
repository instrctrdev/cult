'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeaderNavItem } from './site-header';

/**
 * Desktop mega menu.
 *
 * Opens on hover and on focus, and closes on Escape or blur, so it is usable
 * with a keyboard rather than pointer-only. A short close delay keeps the
 * panel from vanishing while the pointer crosses the gap beneath the trigger.
 */
export function MegaMenu({
  item,
  active,
  overlay = false,
  overlayOnLightArt = false,
}: {
  item: HeaderNavItem;
  active: boolean;
  /** True while the header is transparent over the leading band. */
  overlay?: boolean;
  /** The artwork behind is bright, so the trigger needs ink type. */
  overlayOnLightArt?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = React.useRef<HTMLLIElement>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  React.useEffect(() => () => cancelClose(), []);

  return (
    <li
      ref={wrapRef}
      className="static"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <Link
        href={item.href}
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 items-center gap-1 rounded-md px-3 text-2xs font-medium uppercase tracking-wide2 transition-colors',
          overlay
            ? overlayOnLightArt
              ? 'text-ink/70 hover:text-ink'
              : 'text-white/80 hover:text-white'
            : active || open
              ? 'text-ink'
              : 'text-muted hover:text-ink',
        )}
      >
        {item.label}
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </Link>

      <div
        className={cn(
          'absolute inset-x-0 top-full border-t border-line bg-bg shadow-card transition-[opacity,transform] duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
        )}
      >
        <div className="container grid grid-cols-4 gap-8 py-8">
          <div className="col-span-1">
            <p className="eyebrow mb-2">{item.label}</p>
            <Link
              href={item.href}
              className="font-serif text-lg text-ink underline-offset-4 hover:underline"
            >
              Shop all {item.label.toLowerCase()} →
            </Link>
          </div>

          <ul className="col-span-3 grid grid-cols-3 gap-x-6 gap-y-2.5">
            {item.children?.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/category/${child.slug}`}
                  className="group flex items-baseline justify-between gap-2 py-1 text-sm text-muted transition-colors hover:text-ink"
                >
                  <span className="group-hover:underline group-hover:underline-offset-4">{child.name}</span>
                  <span className="text-2xs text-faint">{child.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
