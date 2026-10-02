'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One primitive covering both patterns the brief asks for:
 *   • `side="bottom"` — mobile bottom sheets (filters, size pickers)
 *   • `side="right"`  — the cart drawer and mobile menu
 *
 * Radix supplies the focus trap, scroll lock, Escape handling and the
 * aria-modal wiring, so keyboard and screen-reader behaviour is correct.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const Overlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className,
    )}
    {...props}
  />
));
Overlay.displayName = 'SheetOverlay';

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'right' | 'left' | 'bottom';
  title: string;
  description?: string;
  /** Hide the visible heading but keep it for assistive tech. */
  hideTitle?: boolean;
  footer?: React.ReactNode;
}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', title, description, hideTitle, footer, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 flex flex-col bg-bg shadow-sheet',
        'data-[state=open]:animate-in data-[state=closed]:animate-out duration-300',
        side === 'right' &&
          'inset-y-0 right-0 h-full w-full max-w-md data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
        side === 'left' &&
          'inset-y-0 left-0 h-full w-full max-w-xs data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
        side === 'bottom' &&
          'inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
        className,
      )}
      {...props}
    >
      {side === 'bottom' && (
        <div className="flex justify-center pt-3" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-ink/15" />
        </div>
      )}

      {/* Visually hidden title still needs the row for the close button, but
          nothing else is holding space there — a smaller title means less
          empty air above whatever the panel puts first. */}
      <div className={cn('flex items-center justify-between gap-4 px-5', hideTitle ? 'pb-1 pt-2' : 'pb-4 pt-4')}>
        <div className="min-w-0">
          <DialogPrimitive.Title className={cn('font-serif text-lg', hideTitle && 'sr-only')}>
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-0.5 text-xs text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          className="-mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </DialogPrimitive.Close>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>

      {footer && <div className="safe-bottom border-t border-line bg-bg px-5 py-4">{footer}</div>}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';
