'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ImageOff, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string | null;
  eyebrow: string | null;
  placement: string;
  desktopImage: string | null;
  mobileImage: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  overlay: string | null;
  position: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const PLACEMENTS = [
  { value: 'HOME_HERO', label: 'Homepage hero' },
  { value: 'HOME_SPLIT', label: 'Homepage split panels' },
  { value: 'HOME_PROMO', label: 'Homepage promo' },
  { value: 'CATEGORY_TOP', label: 'Category banner' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
];

export function BannerManager({ banners, canWrite }: { banners: AdminBanner[]; canWrite: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<AdminBanner | 'new-banner' | 'new-announcement' | null>(null);
  const announcements = banners.filter((banner) => banner.placement === 'ANNOUNCEMENT');
  const imageBanners = banners.filter((banner) => banner.placement !== 'ANNOUNCEMENT');

  const remove = async (banner: AdminBanner) => {
    const res = await fetch(`/api/admin/banners/${banner.id}`, { method: 'DELETE' });
    toast(
      res.ok
        ? { title: banner.placement === 'ANNOUNCEMENT' ? 'Announcement deleted' : 'Banner deleted', variant: 'success' }
        : { title: 'Could not delete.', variant: 'error' },
    );
    if (res.ok) router.refresh();
  };

  return (
    <>
      <section className="space-y-4 rounded-lg border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-serif text-xl">Announcement scroller</h2><p className="mt-1 text-sm text-muted">Messages shown in the moving red strip above the storefront header.</p></div>
          {canWrite && <Button onClick={() => setEditing('new-announcement')}><Plus className="h-4 w-4" aria-hidden />Add announcement</Button>}
        </div>
        {announcements.length ? <ul className="grid gap-3 md:grid-cols-2">{announcements.map((banner) => <BannerCard key={banner.id} banner={banner} canWrite={canWrite} onEdit={() => setEditing(banner)} onDelete={() => void remove(banner)} />)}</ul>
          : <div className="rounded-md border border-dashed border-line p-8 text-center"><p className="text-sm font-medium">No announcement has been added yet.</p><p className="mt-1 text-xs text-muted">Add one and keep it Active to display the scroller on the store.</p>{canWrite && <Button className="mt-4" size="sm" onClick={() => setEditing('new-announcement')}><Plus className="h-4 w-4" aria-hidden />Add first announcement</Button>}</div>}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-xl">Image banners</h2><p className="mt-1 text-sm text-muted">Homepage and category artwork.</p></div>{canWrite && <Button variant="outline" onClick={() => setEditing('new-banner')}><Plus className="h-4 w-4" aria-hidden />New image banner</Button>}</div>
        {imageBanners.length ? <ul className="grid gap-3 md:grid-cols-2">{imageBanners.map((banner) => <BannerCard key={banner.id} banner={banner} canWrite={canWrite} onEdit={() => setEditing(banner)} onDelete={() => void remove(banner)} />)}</ul>
          : <p className="rounded-lg border border-line p-10 text-center text-sm text-muted">No image banners configured.</p>}
      </section>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          title={editing === 'new-announcement' ? 'Add announcement' : editing === 'new-banner' ? 'New image banner' : 'Edit banner'}
          className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-lg lg:rounded-none"
        >
          {editing && (
            <BannerForm
              banner={typeof editing === 'string' ? null : editing}
              defaultPlacement={editing === 'new-announcement' ? 'ANNOUNCEMENT' : 'HOME_HERO'}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function BannerCard({ banner, canWrite, onEdit, onDelete }: { banner: AdminBanner; canWrite: boolean; onEdit: () => void; onDelete: () => void }) {
  const announcement = banner.placement === 'ANNOUNCEMENT';
  return <li className="overflow-hidden rounded-lg border border-line">
    <div className={cn('relative bg-surface', announcement ? 'announcement-bar grid min-h-20 place-items-center px-4 text-center text-xs font-bold uppercase tracking-wide2 text-white' : 'aspect-[16/7]')}>
      {announcement ? <span>{banner.title}{banner.ctaLabel ? ` · ${banner.ctaLabel}` : ''}</span> : banner.desktopImage ? <Image src={banner.desktopImage} alt="" fill sizes="480px" className="object-cover" /> : <div className="grid h-full place-items-center text-center"><span className="flex flex-col items-center gap-1.5 text-xs text-faint"><ImageOff className="h-5 w-5" aria-hidden />Image not uploaded yet</span></div>}
      {banner.videoUrl && !announcement && <span className="absolute left-2 top-2 rounded bg-ink px-2 py-1 text-2xs uppercase tracking-wide2 text-bg">Video mode</span>}
    </div>
    <div className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0">{banner.eyebrow && <p className="text-2xs uppercase tracking-wide2 text-muted">{banner.eyebrow}</p>}<p className="font-serif text-base text-ink">{banner.title}</p><p className="mt-0.5 text-2xs text-faint">{PLACEMENTS.find((p) => p.value === banner.placement)?.label ?? banner.placement} · position {banner.position}</p></div><span className={cn('shrink-0 rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide2', banner.isActive ? 'bg-success/10 text-success' : 'bg-ink/[0.06] text-muted')}>{banner.isActive ? 'Active' : 'Off'}</span></div>
      {canWrite && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={onEdit}>Edit</Button><Button size="sm" variant="ghost" className="text-muted hover:text-danger" aria-label={`Delete ${banner.title}`} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button></div>}
    </div>
  </li>;
}

function BannerForm({ banner, defaultPlacement, onDone }: { banner: AdminBanner | null; defaultPlacement: 'HOME_HERO' | 'ANNOUNCEMENT'; onDone: () => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState<'desktop' | 'mobile' | null>(null);

  const form = useForm({
    defaultValues: {
      title: banner?.title ?? '',
      subtitle: banner?.subtitle ?? '',
      eyebrow: banner?.eyebrow ?? '',
      placement: banner?.placement ?? defaultPlacement,
      desktopImage: banner?.desktopImage ?? '',
      mobileImage: banner?.mobileImage ?? '',
      videoUrl: banner?.videoUrl ?? '',
      ctaLabel: banner?.ctaLabel ?? '',
      ctaHref: banner?.ctaHref ?? '',
      overlay: banner?.overlay ?? 'rgba(26,26,26,0.35)',
      position: banner?.position ?? 0,
      isActive: banner?.isActive ?? true,
      startsAt: banner?.startsAt ?? '',
      endsAt: banner?.endsAt ?? '',
    },
  });
  const placement = form.watch('placement');

  const upload = async (which: 'desktop' | 'mobile', file: File) => {
    setUploading(which);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', 'banners');
      body.append('name', which);

      const res = await fetch('/api/admin/media', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed.');

      form.setValue(which === 'desktop' ? 'desktopImage' : 'mobileImage', json.url);
      toast({ title: 'Image uploaded', variant: 'success' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploading(null);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const payload = {
          ...values,
          position: Number(values.position),
          startsAt: values.startsAt || null,
          endsAt: values.endsAt || null,
        };
        const res = await fetch(banner ? `/api/admin/banners/${banner.id}` : '/api/admin/banners', {
          method: banner ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ title: json?.error?.message ?? 'Could not save.', variant: 'error' });
          return;
        }
        toast({ title: banner ? 'Banner updated' : 'Banner created', variant: 'success' });
        onDone();
      })}
      className="space-y-4 pb-4"
    >
      <Field label="Placement" htmlFor="b-placement">
        <select id="b-placement" className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('placement')}>
          {PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>

      {placement === 'ANNOUNCEMENT' && (
        <p className="rounded-md bg-surface p-3 text-sm text-muted">
          This message scrolls above the storefront header. Add several active announcements to rotate sale messages, coupon codes and delivery updates.
        </p>
      )}

      <Field label="Eyebrow" htmlFor="b-eyebrow" hint="Small line above the headline">
        <Input {...form.register('eyebrow')} />
      </Field>
      <Field label="Headline" htmlFor="b-title" required>
        <Input {...form.register('title', { required: true })} />
      </Field>
      <Field label="Subtitle" htmlFor="b-subtitle">
        <Textarea rows={2} {...form.register('subtitle')} />
      </Field>

      {placement !== 'ANNOUNCEMENT' && (['desktop', 'mobile'] as const).map((which) => {
        const key = which === 'desktop' ? 'desktopImage' : 'mobileImage';
        const value = form.watch(key);
        return (
          <div key={which}>
            <Field
              label={`${which === 'desktop' ? 'Desktop' : 'Mobile'} image`}
              htmlFor={`b-${which}`}
              hint={which === 'desktop' ? 'Wide crop, shown from 768px up' : 'Tall crop, shown on phones'}
            >
              <Input readOnly value={value} placeholder="Not set" {...form.register(key)} />
            </Field>
            <label className="mt-1.5 inline-block cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={uploading !== null}
                onChange={(e) => e.target.files?.[0] && upload(which, e.target.files[0])}
              />
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 hover:border-ink">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {uploading === which ? 'Uploading…' : 'Upload'}
              </span>
            </label>
          </div>
        );
      })}

      {placement !== 'ANNOUNCEMENT' && <Field
          label="Video URL"
          htmlFor="b-video"
          hint="Optional. Setting this switches the hero to video mode, using the desktop image as the poster frame."
        >
          <Input type="url" placeholder="https://…" {...form.register('videoUrl')} />
        </Field>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={placement === 'ANNOUNCEMENT' ? 'Highlighted text' : 'Button label'} htmlFor="b-cta" hint={placement === 'ANNOUNCEMENT' ? 'Example: USE CODE DASARA60' : undefined}>
          <Input {...form.register('ctaLabel')} />
        </Field>
        <Field label={placement === 'ANNOUNCEMENT' ? 'Optional link' : 'Button link'} htmlFor="b-href" hint="e.g. /category/dasara-sale">
          <Input {...form.register('ctaHref')} />
        </Field>
      </div>

      {placement !== 'ANNOUNCEMENT' && <Field label="Overlay colour" htmlFor="b-overlay" hint="Darkens the image so text stays readable.">
          <Input {...form.register('overlay')} />
        </Field>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Position" htmlFor="b-position">
          <Input type="number" min="0" {...form.register('position')} />
        </Field>
        <Field label="Starts" htmlFor="b-start">
          <Input type="date" {...form.register('startsAt')} />
        </Field>
        <Field label="Ends" htmlFor="b-end">
          <Input type="date" {...form.register('endsAt')} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('isActive')} />
        Active
      </label>

      <Button type="submit" size="lg" full loading={form.formState.isSubmitting}>
        {banner ? 'Save banner' : 'Create banner'}
      </Button>
    </form>
  );
}
