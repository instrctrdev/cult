'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export type PromoRow = {
  id: string; eyebrow: string | null; title: string; href: string;
  desktopImage: string; mobileImage: string | null; imageAlt: string | null;
  position: number; isActive: boolean;
};
export type ReelRow = {
  id: string; title: string; videoUrl: string; posterUrl: string | null;
  productIds: string[]; position: number; isActive: boolean;
};
type ProductChoice = { id: string; name: string };

async function uploadMedia(file: File, folder: string, name: string, video = false): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  body.append('folder', folder);
  body.append('name', name);
  const res = await fetch(video ? '/api/admin/media/video' : '/api/admin/media', { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed.');
  return json.url;
}

async function saveRecord(path: string, data: unknown, editing: boolean) {
  const res = await fetch(path, {
    method: editing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.error?.details?.[0]?.message;
    throw new Error(detail ?? json?.error?.message ?? 'Could not save.');
  }
}

function UploadField({ label, size, value, accept, busy, onUpload, onClear }: {
  label: string; size: string; value: string | null; accept: string; busy: boolean;
  onUpload: (file: File) => void; onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-line bg-bg p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted">Recommended: {size}</p></div>
        <div className="flex gap-2">
          {value && <button type="button" onClick={onClear} className="text-xs text-muted underline">Clear</button>}
          <label className="cursor-pointer rounded border border-line px-3 py-2 text-xs hover:border-ink">
            <input type="file" accept={accept} disabled={busy} className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = '';
            }} />
            {busy ? 'Uploading…' : 'Upload'}
          </label>
        </div>
      </div>
      {value && <p className="mt-2 truncate font-mono text-xs text-muted" title={value}>{value}</p>}
    </div>
  );
}

const inputClass = 'h-11 w-full rounded-md border border-line bg-bg px-3 text-sm text-ink';
const fieldLabel = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-muted';

export function HomepagePromoManager({ promos, canWrite }: { promos: PromoRow[]; canWrite: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<PromoRow | 'new' | null>(null);
  const [form, setForm] = React.useState<Omit<PromoRow, 'id'>>({
    eyebrow: '', title: '', href: '/shop', desktopImage: '', mobileImage: '', imageAlt: '', position: promos.length, isActive: true,
  });
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);

  const open = (promo: PromoRow | 'new') => {
    setEditing(promo);
    setForm(promo === 'new' ? {
      eyebrow: '', title: '', href: '/shop', desktopImage: '', mobileImage: '', imageAlt: '', position: promos.length, isActive: true,
    } : { eyebrow: promo.eyebrow, title: promo.title, href: promo.href,
      desktopImage: promo.desktopImage, mobileImage: promo.mobileImage, imageAlt: promo.imageAlt,
      position: promo.position, isActive: promo.isActive });
  };

  const upload = async (which: 'desktopImage' | 'mobileImage', file: File) => {
    setUploading(which);
    try {
      const url = await uploadMedia(file, 'home-promos', `promo-${which}`);
      setForm((current) => ({ ...current, [which]: url }));
      toast({ title: 'Image uploaded. Save the card to publish it.', variant: 'success' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally { setUploading(null); }
  };

  const save = async () => {
    if (!form.desktopImage) return toast({ title: 'Upload a desktop image first.', variant: 'error' });
    setBusy(true);
    try {
      await saveRecord(editing === 'new' ? '/api/admin/homepage/promos' : `/api/admin/homepage/promos/${(editing as PromoRow).id}`, form, editing !== 'new');
      toast({ title: 'Category feature saved', variant: 'success' });
      setEditing(null);
      router.refresh();
    } catch (err) { toast({ title: err instanceof Error ? err.message : 'Could not save.', variant: 'error' }); }
    finally { setBusy(false); }
  };

  const remove = async (promo: PromoRow) => {
    if (!window.confirm(`Delete the “${promo.title}” feature?`)) return;
    const res = await fetch(`/api/admin/homepage/promos/${promo.id}`, { method: 'DELETE' });
    toast({ title: res.ok ? 'Feature deleted' : 'Could not delete feature', variant: res.ok ? 'success' : 'error' });
    if (res.ok) router.refresh();
  };

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Category features</h2><p className="mt-1 text-sm text-muted">Extra campaign cards after Bestsellers. Each card can link to any collection.</p></div>
        {canWrite && <Button onClick={() => open('new')}>Add category feature</Button>}
      </div>
      <p className="text-xs text-muted">Upload each crop separately: desktop 1600 × 675 px; mobile 1080 × 456 px. Text is added by the site so the images remain reusable.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {promos.map((promo) => <div key={promo.id} className="overflow-hidden rounded-md border border-line bg-bg">
          <div className="relative aspect-[2.36/1] bg-sunken"><Image src={promo.desktopImage} alt="" fill sizes="(max-width: 767px) 100vw, 33vw" className="object-cover" /></div>
          <div className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{promo.title}</p><p className="truncate text-xs text-muted">{promo.href} · {promo.isActive ? 'Live' : 'Hidden'}</p></div>
            {canWrite && <div className="flex gap-2"><button type="button" onClick={() => open(promo)} className="text-xs underline">Edit</button><button type="button" onClick={() => void remove(promo)} className="text-xs text-danger underline">Delete</button></div>}
          </div>
        </div>)}
      </div>
      {editing && <div className="space-y-4 rounded-lg border border-line bg-bg p-4">
        <h3 className="font-semibold">{editing === 'new' ? 'New category feature' : `Edit ${editing.title}`}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={fieldLabel}>Small label</span><input className={inputClass} maxLength={80} value={form.eyebrow ?? ''} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} /></label>
          <label><span className={fieldLabel}>Large title</span><input className={inputClass} required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span className={fieldLabel}>Shop link</span><input className={inputClass} required value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/category/shirts" /></label>
          <label><span className={fieldLabel}>Image description</span><input className={inputClass} maxLength={255} value={form.imageAlt ?? ''} onChange={(e) => setForm({ ...form, imageAlt: e.target.value })} /></label>
          <label><span className={fieldLabel}>Display order</span><input className={inputClass} type="number" min={0} value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Live</label>
        </div>
        <UploadField label="Desktop banner" size="1600 × 675 px (2.36:1)" value={form.desktopImage} accept="image/jpeg,image/png,image/webp,image/avif" busy={uploading !== null} onUpload={(file) => void upload('desktopImage', file)} onClear={() => setForm({ ...form, desktopImage: '' })} />
        <UploadField label="Mobile banner" size="1080 × 456 px (2.36:1)" value={form.mobileImage} accept="image/jpeg,image/png,image/webp,image/avif" busy={uploading !== null} onUpload={(file) => void upload('mobileImage', file)} onClear={() => setForm({ ...form, mobileImage: '' })} />
        <div className="flex gap-2"><Button disabled={busy || uploading !== null} onClick={() => void save()}>{busy ? 'Saving…' : 'Save feature'}</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
      </div>}
    </section>
  );
}

export function HomepageReelManager({ reels, products, canWrite }: {
  reels: ReelRow[]; products: ProductChoice[]; canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<ReelRow | 'new' | null>(null);
  const [form, setForm] = React.useState<Omit<ReelRow, 'id'>>({ title: '', videoUrl: '', posterUrl: '', productIds: ['', '', '', '', ''], position: reels.length, isActive: true });
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState<string | null>(null);

  const open = (reel: ReelRow | 'new') => {
    setEditing(reel);
    setForm(reel === 'new'
      ? { title: '', videoUrl: '', posterUrl: '', productIds: ['', '', '', '', ''], position: reels.length, isActive: true }
      : { title: reel.title, videoUrl: reel.videoUrl, posterUrl: reel.posterUrl,
        productIds: [...reel.productIds, '', '', '', '', ''].slice(0, 5), position: reel.position, isActive: reel.isActive });
  };

  const upload = async (which: 'videoUrl' | 'posterUrl', file: File) => {
    setUploading(which);
    try {
      const url = await uploadMedia(file, which === 'videoUrl' ? 'home-reels' : 'home-reel-posters', 'reel', which === 'videoUrl');
      setForm((current) => ({ ...current, [which]: url }));
      toast({ title: 'Media uploaded. Save the reel to publish it.', variant: 'success' });
    } catch (err) { toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' }); }
    finally { setUploading(null); }
  };

  const save = async () => {
    if (!form.videoUrl) return toast({ title: 'Upload a reel video first.', variant: 'error' });
    if (form.productIds.some((id) => !id) || new Set(form.productIds).size !== 5) return toast({ title: 'Choose five different products.', variant: 'error' });
    setBusy(true);
    try {
      await saveRecord(editing === 'new' ? '/api/admin/homepage/reels' : `/api/admin/homepage/reels/${(editing as ReelRow).id}`, form, editing !== 'new');
      toast({ title: 'Shoppable reel saved', variant: 'success' });
      setEditing(null);
      router.refresh();
    } catch (err) { toast({ title: err instanceof Error ? err.message : 'Could not save.', variant: 'error' }); }
    finally { setBusy(false); }
  };

  const remove = async (reel: ReelRow) => {
    if (!window.confirm(`Delete the “${reel.title}” reel?`)) return;
    const res = await fetch(`/api/admin/homepage/reels/${reel.id}`, { method: 'DELETE' });
    toast({ title: res.ok ? 'Reel deleted' : 'Could not delete reel', variant: res.ok ? 'success' : 'error' });
    if (res.ok) router.refresh();
  };

  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Shoppable reels</h2><p className="mt-1 text-sm text-muted">Short videos after Trending. Each reel has a bubble containing five product links.</p></div>
        {canWrite && <Button onClick={() => open('new')}>Add reel</Button>}
      </div>
      <p className="text-xs text-muted">Video: 1080 × 1920 px (9:16), MP4 or WebM. Poster: 1080 × 1920 px. Keep clips short and compressed for fast mobile loading.</p>
      <div className="flex flex-wrap gap-3">
        {reels.map((reel) => <div key={reel.id} className="w-40 rounded-md border border-line bg-bg p-2">
          <div className="relative aspect-[9/16] overflow-hidden rounded bg-sunken">{reel.posterUrl ? <Image src={reel.posterUrl} alt="" fill sizes="160px" className="object-cover" /> : <video src={reel.videoUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />}</div>
          <p className="mt-2 truncate text-sm font-semibold">{reel.title}</p><p className="text-xs text-muted">{reel.isActive ? 'Live' : 'Hidden'} · {reel.productIds.length} products</p>
          {canWrite && <div className="mt-2 flex gap-3"><button type="button" onClick={() => open(reel)} className="text-xs underline">Edit</button><button type="button" onClick={() => void remove(reel)} className="text-xs text-danger underline">Delete</button></div>}
        </div>)}
      </div>
      {editing && <div className="space-y-4 rounded-lg border border-line bg-bg p-4">
        <h3 className="font-semibold">{editing === 'new' ? 'New shoppable reel' : `Edit ${editing.title}`}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={fieldLabel}>Reel title</span><input className={inputClass} maxLength={120} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span className={fieldLabel}>Display order</span><input className={inputClass} type="number" min={0} value={form.position} onChange={(e) => setForm({ ...form, position: Number(e.target.value) })} /></label>
        </div>
        <UploadField label="Reel video" size="1080 × 1920 px (9:16), MP4/WebM" value={form.videoUrl} accept="video/mp4,video/webm" busy={uploading !== null} onUpload={(file) => void upload('videoUrl', file)} onClear={() => setForm({ ...form, videoUrl: '' })} />
        <UploadField label="Poster image" size="1080 × 1920 px (9:16)" value={form.posterUrl} accept="image/jpeg,image/png,image/webp,image/avif" busy={uploading !== null} onUpload={(file) => void upload('posterUrl', file)} onClear={() => setForm({ ...form, posterUrl: '' })} />
        <div><p className={fieldLabel}>Five products in the reel bubble</p><div className="grid gap-2 sm:grid-cols-2">
          {form.productIds.map((id, index) => <label key={index} className="flex items-center gap-2 text-xs"><span className="w-4">{index + 1}</span><select className={inputClass} value={id} onChange={(e) => setForm((current) => ({ ...current, productIds: current.productIds.map((value, i) => i === index ? e.target.value : value) }))}>
            <option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select></label>)}
        </div></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Live</label>
        <div className="flex gap-2"><Button disabled={busy || uploading !== null} onClick={() => void save()}>{busy ? 'Saving…' : 'Save reel'}</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button></div>
      </div>}
    </section>
  );
}
