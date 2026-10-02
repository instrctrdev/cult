import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sizes keep a >=44px touch target on mobile controls — the `sm` variant is
 * for dense desktop toolbars only.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium transition-[background-color,color,border-color,opacity] duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99] select-none',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-bg hover:bg-ink/90',
        gold: 'bg-gold text-white hover:bg-gold/90',
        outline: 'border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink/[0.03]',
        ghost: 'bg-transparent text-ink hover:bg-ink/[0.06]',
        subtle: 'bg-surface text-ink hover:bg-sunken',
        danger: 'bg-danger text-white hover:bg-danger/90',
        link: 'text-ink underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-xs tracking-wide2 uppercase rounded-md',
        md: 'h-11 px-5 text-xs tracking-wide2 uppercase rounded-md',
        lg: 'h-12 px-7 text-xs tracking-luxe uppercase rounded-md',
        xl: 'h-14 px-8 text-sm tracking-luxe uppercase rounded-md',
        icon: 'h-11 w-11 rounded-full',
        'icon-sm': 'h-9 w-9 rounded-full',
      },
      full: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    // `asChild` renders someone else's element, so the spinner is skipped
    // rather than injected as an extra child (Slot accepts exactly one).
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, full, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, full, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
