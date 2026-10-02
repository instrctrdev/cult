'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Restore / erase, shown only in Products → Deleted.
 *
 * Erasing is offered because a deleted product is otherwise invisible
 * forever, which reads as clutter nobody can clear. The server refuses to
 * erase anything a customer has ordered — that order has to keep being able
 * to say what it was for — so the failure is explained rather than hidden.
 */
export function DeletedProductActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<'restore' | 'erase' | null>(null);

  async function restore() {
    setBusy('restore');
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json?.error?.message ?? 'Could not restore that product.', variant: 'error' });
        return;
      }
      toast({
        title: 'Product restored',
        description: 'It is back as a draft — publish it when you are ready.',
        variant: 'success',
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function erase() {
    if (!window.confirm(`Permanently erase "${name}"? This cannot be undone.`)) return;
    setBusy('erase');
    try {
      const res = await fetch(`/api/admin/products/${id}?permanent=1`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json?.error?.message ?? 'Could not erase that product.', variant: 'error' });
        return;
      }
      toast({ title: 'Product erased', variant: 'success' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" loading={busy === 'restore'} disabled={busy !== null} onClick={restore}>
        Restore
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted hover:text-danger"
        loading={busy === 'erase'}
        disabled={busy !== null}
        onClick={erase}
      >
        Erase
      </Button>
    </div>
  );
}
