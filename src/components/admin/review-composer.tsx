'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Star, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type Draft = { kind: 'IMAGE' | 'VIDEO'; url: string; posterUrl: string | null };

/**
 * Add a review the store collected off-site.
 *
 * Reviews are not taken through the storefront — what customers send over
 * WhatsApp or Instagram is entered here instead, with the photos and clips
 * that came with it. There is no "verified buyer" control on purpose: that
 * badge is a claim about a real delivered order, and is only ever set from
 * one.
 */
export function ReviewComposer({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [productId, setProductId] = React.useState('');
  const [authorName, setAuthorName] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [date, setDate] = React.useState('');
  const [media, setMedia] = React.useState<Draft[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const reset = () => {
    setProductId('');
    setAuthorName('');
    setRating(5);
    setTitle('');
    setBody('');
    setDate('');
    setMedia([]);
  };

  /** Files upload as they are picked, so a slow clip never blocks typing. */
  const upload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const form = new FormData();
        form.append('file', file);
        form.append('folder', isVideo ? 'review-videos' : 'reviews');
        form.append('name', 'review');

        const res = await fetch(isVideo ? '/api/admin/media/video' : '/api/admin/media', {
          method: 'POST',
          body: form,
        });
        const stored = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(stored?.error?.message ?? `Could not upload ${file.name}.`);

        setMedia((prev) => [...prev, { kind: isVideo ? 'VIDEO' : 'IMAGE', url: stored.url, posterUrl: null }]);
      }
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!productId) return toast({ title: 'Choose which product this is about.', variant: 'error' });
    if (!authorName.trim()) return toast({ title: 'Add the customer’s name.', variant: 'error' });

    setSaving(true);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          authorName: authorName.trim(),
          rating,
          title: title.trim() || null,
          body: body.trim() || null,
          // A date-only input has no time; noon avoids a timezone shift
          // dragging the review onto the previous day.
          createdAt: date ? new Date(`${date}T12:00:00`).toISOString() : null,
          media,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Could not save that review.');

      toast({ title: 'Review published', variant: 'success' });
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save that review.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>Add a customer review</Button>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-line p-5">
      <h2 className="font-serif text-lg">Add a customer review</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product" htmlFor="r-product">
          <select
            id="r-product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full rounded-md border border-line bg-bg px-3 text-sm"
          >
            <option value="">Choose a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Customer name" htmlFor="r-name">
          <Input id="r-name" value={authorName} maxLength={150} onChange={(e) => setAuthorName(e.target.value)} />
        </Field>
      </div>

      <Field label="Rating" htmlFor="r-rating">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              onClick={() => setRating(star)}
              className="grid h-8 w-8 place-items-center rounded hover:bg-surface"
            >
              <Star className={cn('h-5 w-5', star <= rating ? 'fill-gold-ink text-gold-ink' : 'text-ink/20')} />
            </button>
          ))}
        </div>
      </Field>

      <Field label="Headline" htmlFor="r-title" hint="Optional — a short line from what the customer said.">
        <Input id="r-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
      </Field>

      <Field label="What they said" htmlFor="r-body">
        <Textarea id="r-body" rows={4} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <Field
        label="Date received"
        htmlFor="r-date"
        hint="Optional. Leave blank to use today — worth setting when entering older messages in a batch."
      >
        <Input id="r-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-wide2 text-muted">Photos and videos</span>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
            <span
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2',
                uploading ? 'opacity-50' : 'hover:border-ink',
              )}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {uploading ? 'Uploading…' : 'Upload'}
            </span>
          </label>
        </div>

        {media.length === 0 ? (
          <p className="rounded-md border border-dashed border-line p-6 text-center text-xs text-muted">
            Nothing attached yet. Images become WebP; videos must be MP4 or WebM.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {media.map((m, i) => (
              <li key={m.url} className="relative">
                <div className="relative aspect-square overflow-hidden rounded-md bg-ink">
                  {m.kind === 'IMAGE' ? (
                    <Image src={m.url} alt="" fill sizes="120px" className="object-cover" />
                  ) : (
                    <video src={m.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove attachment"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded bg-bg/90 text-muted hover:text-danger"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} loading={saving}>Publish review</Button>
        <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
      </div>
    </section>
  );
}
