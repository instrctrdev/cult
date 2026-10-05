import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Responsive versions of the supplied CULT Clothing brand mark. */
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
    <span className={cn('relative inline-block h-[1.5em] w-[3.38em] leading-none', className)}>
      <Image
        src={inverted ? '/images/brand/cult-logo-light.png' : '/images/brand/cult-logo-dark.png'}
        alt={showDescriptor ? 'CULT Clothing' : 'CULT'}
        fill
        sizes="160px"
        className="object-contain"
        priority
      />
    </span>
  );
}
