'use client';

import * as React from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface AdminHomepageSection {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  href: string;
  desktopImage: string | null;
  mobileImage: string | null;
  videoUrl: string | null;
  imageAlt: string | null;
  focalDesktop: string;
  focalMobile: string;
  textMode: string;
  textAlign: string;
  theme: string;
  overlayStrength: number;
  showProductRail: boolean;
  railSource: string | null;
  priority: boolean;
  comingSoon: boolean;
  isActive: boolean;
  position: number;
  desktopOnDisk: boolean;
  mobileOnDisk: boolean;
}

type FormValues = Omit<AdminHomepageSection, 'id' | 'desktopOnDisk' | 'mobileOnDisk'>;

/** Nine focal presets, which covers almost every fashion crop. */
const FOCAL_PRESETS = [
  { value: 'left top', label: '↖' }, { value: 'center top', label: '↑' }, { value: 'right top', label: '↗' },
  { value: 'left center', label: '←' }, { value: 'center center', label: '•' }, { value: 'right center', label: '→' },
  { value: 'left bottom', label: '↙' }, { value: 'center bottom', label: '↓' }, { value: 'right bottom', label: '↘' },
];

const RAIL_SOURCES = [
  { value: 'new', label: 'New arrivals' },
  { value: 'bestseller', label: 'Best sellers' },
  { value: 'sale', label: 'On sale' },
  { value: 'featured', label: 'Featured' },
];

export function HomepageSectionForm({
  section,
  nextPosition,
  onDone,
}: {
  section: AdminHomepageSection | null;
  nextPosition: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState<'desktop' | 'mobile' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      key: section?.key ?? '',
      title: section?.title ?? '',
      subtitle: section?.subtitle ?? '',
      ctaLabel: section?.ctaLabel ?? '+ SHOP NOW',
      href: section?.href ?? '/shop',
      desktopImage: section?.desktopImage ?? '',
      mobileImage: section?.mobileImage ?? '',
      videoUrl: section?.videoUrl ?? '',
      imageAlt: section?.imageAlt ?? '',
      focalDesktop: section?.focalDesktop ?? '50% 50%',
      focalMobile: section?.focalMobile ?? '50% 35%',
      textMode: section?.textMode ?? 'IMAGE',
      textAlign: section?.textAlign ?? 'BOTTOM_LEFT',
      theme: section?.theme ?? 'LIGHT',
      overlayStrength: section?.overlayStrength ?? 35,
      showProductRail: section?.showProductRail ?? false,
      railSource: section?.railSource ?? 'new',
      priority: section?.priority ?? false,
      comingSoon: section?.comingSoon ?? false,
      isActive: section?.isActive ?? true,
      position: section?.position ?? nextPosition,
    },
  });

  const textMode = form.watch('textMode');
  const showRail = form.watch('showProductRail');
  const desktopImage = form.watch('desktopImage');
  const mobileImage = form.watch('mobileImage');
  const focalDesktop = form.watch('focalDesktop');
  const focalMobile = form.watch('focalMobile');
  const overlayStrength = form.watch('overlayStrength');

  const upload = async (which: 'desktop' | 'mobile', file: File) => {
    setUploading(which);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', 'home');
      body.append('name', `${form.getValues('key') || 'section'}-${which}`);

      const res = await fetch('/api/admin/media', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Upload failed.');

      form.setValue(which === 'desktop' ? 'desktopImage' : 'mobileImage', json.url);
      toast({ title: `${which === 'desktop' ? 'Desktop' : 'Mobile'} artwork uploaded`, variant: 'success' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploading(null);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        const res = await fetch(
          section ? `/api/admin/homepage/${section.id}` : '/api/admin/homepage',
          {
            method: section ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            json?.error?.details?.[0]
              ? `${json.error.details[0].path}: ${json.error.details[0].message}`
              : json?.error?.message ?? 'Could not save the section.',
          );
          return;
        }
        toast({ title: section ? 'Section saved' : 'Section created', variant: 'success' });
        onDone();
      })}
      className="space-y-5 pb-4"
    >
      {error && <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      {/* ── Artwork ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="font-serif text-base">Artwork</h3>

        {(['desktop', 'mobile'] as const).map((which) => {
          const key = which === 'desktop' ? ('desktopImage' as const) : ('mobileImage' as const);
          const value = which === 'desktop' ? desktopImage : mobileImage;
          const focal = which === 'desktop' ? focalDesktop : focalMobile;

          return (
            <div key={which} className="rounded-md border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-ink">
                  {which === 'desktop' ? 'Desktop — 16:9' : 'Mobile — 9:16'}
                </p>
                <div className="flex items-center gap-1.5">
                  {value && (
                    <button
                      type="button"
                      onClick={() => form.setValue(key, '')}
                      className="grid h-7 w-7 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
                      aria-label={`Clear ${which} image`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      disabled={uploading !== null}
                      onChange={(e) => e.target.files?.[0] && upload(which, e.target.files[0])}
                    />
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ink/25 px-2.5 text-2xs uppercase tracking-wide2 hover:border-ink">
                      <Upload className="h-3 w-3" aria-hidden />
                      {uploading === which ? 'Uploading…' : 'Upload'}
                    </span>
                  </label>
                </div>
              </div>

              <div
                className={cn(
                  'relative overflow-hidden rounded bg-surface',
                  which === 'desktop' ? 'aspect-video' : 'mx-auto aspect-[9/16] w-32',
                )}
              >
                {value ? (
                  <>
                    <Image
                      src={value}
                      alt=""
                      fill
                      sizes="400px"
                      className="object-cover"
                      style={{ objectPosition: focal }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage: `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,${overlayStrength / 100}) 100%)`,
                      }}
                      aria-hidden
                    />
                  </>
                ) : (
                  <span className="grid h-full place-items-center px-2 text-center text-2xs text-faint">
                    Not set
                  </span>
                )}
              </div>

              <Field
                label="Path"
                htmlFor={`hs-${which}`}
                className="mt-2"
                hint={`Or drop a file at public/images/home/${form.watch('key') || '<key>'}-${which}.jpg`}
              >
                <Input className="h-9 font-mono text-xs" {...form.register(key)} />
              </Field>

              {/* Focal point — keeps faces out of the crop. */}
              <div className="mt-3">
                <p className="mb-1.5 text-2xs uppercase tracking-wide2 text-muted">Focal point</p>
                <div className="flex items-start gap-3">
                  <div className="grid w-24 shrink-0 grid-cols-3 gap-0.5">
                    {FOCAL_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        aria-label={`Focus ${preset.value}`}
                        aria-pressed={focal === preset.value}
                        onClick={() =>
                          form.setValue(which === 'desktop' ? 'focalDesktop' : 'focalMobile', preset.value)
                        }
                        className={cn(
                          'grid h-7 place-items-center rounded text-xs transition-colors',
                          focal === preset.value ? 'bg-ink text-bg' : 'bg-surface text-muted hover:bg-sunken',
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    className="h-9 flex-1 font-mono text-xs"
                    aria-label={`${which} focal point`}
                    {...form.register(which === 'desktop' ? 'focalDesktop' : 'focalMobile')}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Field
          label="Image description (alt text)"
          htmlFor="hs-alt"
          hint="Describes the photograph for screen readers and search engines."
        >
          <Input {...form.register('imageAlt')} />
        </Field>

        <Field label="Video URL (optional)" htmlFor="hs-video" hint="Setting this plays video instead, using the desktop image as the poster.">
          <Input type="url" placeholder="https://…" {...form.register('videoUrl')} />
        </Field>
      </section>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-line pt-5">
        <h3 className="font-serif text-base">Content</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key" htmlFor="hs-key" required hint="Lowercase id, e.g. fresh-arrivals">
            <Input className="font-mono text-xs" {...form.register('key', { required: true })} />
          </Field>
          <Field label="Title" htmlFor="hs-title" required>
            <Input {...form.register('title', { required: true })} />
          </Field>
        </div>

        <Field label="Subtitle" htmlFor="hs-subtitle">
          <Input {...form.register('subtitle')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link" htmlFor="hs-href" required hint="Internal path, e.g. /category/shirts">
            <Input className="font-mono text-xs" {...form.register('href', { required: true })} />
          </Field>
          <Field label="CTA label" htmlFor="hs-cta">
            <Input {...form.register('ctaLabel')} />
          </Field>
        </div>

        <Field
          label="Wording"
          htmlFor="hs-textMode"
          hint="When campaign artwork already includes its wording, leave this on “In the image”."
        >
          <select id="hs-textMode" className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('textMode')}>
            <option value="IMAGE">In the image — draw nothing on top</option>
            <option value="OVERLAY">Rendered by the site over the photo</option>
          </select>
        </Field>

        {textMode === 'OVERLAY' && (
          <div className="grid gap-4 rounded-md bg-surface p-3 sm:grid-cols-2">
            <Field label="Text position" htmlFor="hs-align">
              <select id="hs-align" className="h-11 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('textAlign')}>
                <option value="CENTER">Centre</option>
                <option value="BOTTOM_LEFT">Bottom left</option>
                <option value="BOTTOM_CENTER">Bottom centre</option>
                <option value="BOTTOM_RIGHT">Bottom right</option>
                <option value="TOP_LEFT">Top left</option>
              </select>
            </Field>
            <Field label="Text colour" htmlFor="hs-theme">
              <select id="hs-theme" className="h-11 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('theme')}>
                <option value="LIGHT">Light — for darker photos</option>
                <option value="DARK">Dark — for bright photos</option>
              </select>
            </Field>
          </div>
        )}

        <Field
          label={`Overlay darkness — ${overlayStrength}%`}
          htmlFor="hs-overlay"
          hint="A gradient at the foot of the image. Keep it low so photography stays dominant."
        >
          <input
            id="hs-overlay"
            type="range"
            min={0}
            max={80}
            step={5}
            className="h-11 w-full accent-ink"
            {...form.register('overlayStrength', { valueAsNumber: true })}
          />
        </Field>
      </section>

      {/* ── Behaviour ────────────────────────────────────────────────── */}
      <section className="space-y-3 border-t border-line pt-5">
        <h3 className="font-serif text-base">Behaviour</h3>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('isActive')} />
          Live on the homepage
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" {...form.register('priority')} />
          <span>
            Hero band
            <span className="block text-xs text-muted">
              Loads its image immediately. Only the first, above-the-fold band should use this.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('showProductRail')} />
          Show a product carousel beneath this band
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" {...form.register('comingSoon')} />
          <span>
            Coming soon
            <span className="block text-xs text-muted">
              Shows a &ldquo;Coming Soon&rdquo; badge and disables the link — for a category with no stock yet.
            </span>
          </span>
        </label>

        {showRail && (
          <Field label="Carousel products" htmlFor="hs-rail">
            <select id="hs-rail" className="h-11 w-full rounded-md border border-ink/15 bg-bg px-3" {...form.register('railSource')}>
              {RAIL_SOURCES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        )}
      </section>

      <Button type="submit" size="lg" full loading={form.formState.isSubmitting}>
        {section ? 'Save section' : 'Create section'}
      </Button>
    </form>
  );
}
