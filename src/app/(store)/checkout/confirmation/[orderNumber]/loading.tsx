import { Loader2 } from 'lucide-react';

export default function ConfirmationLoading() {
  return (
    <main className="container grid min-h-[420px] place-items-center py-16 text-center text-sm text-muted" role="status">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Checking payment status...
      </span>
    </main>
  );
}
