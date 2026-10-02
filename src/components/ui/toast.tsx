'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { Check, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (input: Omit<ToastItem, 'id'> | string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** `const { toast } = useToast()` — used for add-to-bag and error feedback. */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const toast = React.useCallback((input: Omit<ToastItem, 'id'> | string) => {
    const next: ToastItem =
      typeof input === 'string'
        ? { id: ++counter.current, title: input, variant: 'info' }
        : { id: ++counter.current, ...input };
    setItems((prev) => [...prev.slice(-2), next]);
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}

        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && setItems((prev) => prev.filter((t) => t.id !== item.id))}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-bg p-4 shadow-lift',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom md:data-[state=open]:slide-in-from-right',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
              'data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0',
              item.variant === 'error' ? 'border-danger/30' : 'border-line',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full',
                item.variant === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success',
              )}
              aria-hidden
            >
              {item.variant === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            </span>

            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-ink">{item.title}</ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-muted">
                  {item.description}
                </ToastPrimitive.Description>
              )}
              {item.action && (
                <ToastPrimitive.Action asChild altText={item.action.label}>
                  <button
                    onClick={item.action.onClick}
                    className="mt-2 text-xs font-medium uppercase tracking-wide2 text-gold-ink underline-offset-4 hover:underline"
                  >
                    {item.action.label}
                  </button>
                </ToastPrimitive.Action>
              )}
            </div>

            <ToastPrimitive.Close className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-full text-faint hover:bg-surface hover:text-ink" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}

        <ToastPrimitive.Viewport
          className={cn(
            'pointer-events-none fixed z-[80] flex w-full max-w-sm flex-col gap-2 p-4',
            // Sits above the mobile bottom nav, right-aligned on desktop.
            'bottom-[calc(var(--bottom-nav-h)+0.5rem)] left-1/2 -translate-x-1/2',
            'md:bottom-4 md:left-auto md:right-4 md:translate-x-0',
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
