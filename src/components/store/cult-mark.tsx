import { cn } from '@/lib/utils';

/** A compact, responsive script wordmark until the final vector logo is supplied. */
export function CultMark({
  className,
  inverted = false,
  showDescriptor = true,
}: {
  className?: string;
  inverted?: boolean;
  showDescriptor?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-end gap-1 leading-none', className)}>
      <span
        className={cn(
          'font-script text-[2.15em] font-bold leading-[0.7]',
          inverted ? 'text-white' : 'text-danger',
        )}
      >
        Cult
      </span>
      {showDescriptor && (
        <span className={cn('mb-[0.02em] font-sans text-[0.35em] font-semibold uppercase tracking-[0.1em]', inverted ? 'text-white/80' : 'text-ink')}>
          Clothing
        </span>
      )}
    </span>
  );
}
