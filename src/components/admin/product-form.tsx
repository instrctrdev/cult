'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ArrowDown, ArrowUp, Barcode, Trash2, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { adminProductSchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import { VariantEditor, type VariantRow } from './variant-editor';

type FormValues = z.input<typeof adminProductSchema>;

export interface ProductImageRow {
  id: string;
  url: string;
  alt: string | null;
  isPlaceholder: boolean;
  aiGenerated: boolean;
}

export interface ProductVideoRow {
  id: string;
  url: string;
  posterUrl: string | null;
  alt: string | null;
}

export interface ProductFormData {
  id: string | null;
  values: FormValues;
  images: ProductImageRow[];
  videos: ProductVideoRow[];
  variants: VariantRow[];
}

interface PendingImage {
  key: string;
  file: File;
  previewUrl: string;
}

/**
 * Create / edit a product.
 *
 * The new-product form collects variants and image files before the first save.
 * Existing products keep independent image and stock controls.
 */
export function ProductForm({
  data,
  categories,
  sizes,
  colors,
}: {
  data: ProductFormData;
  categories: { id: string; name: string }[];
  sizes: { id: string; code: string; label: string }[];
  colors: { id: string; name: string; hex: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isNew = data.id === null;

  const [images, setImages] = React.useState(data.images);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const pendingUrls = React.useRef(new Set<string>());
  const [draftVariants, setDraftVariants] = React.useState<VariantRow[]>(data.variants);
  const [videos, setVideos] = React.useState(data.videos);
  const [uploading, setUploading] = React.useState(false);
  const [uploadingVideo, setUploadingVideo] = React.useState(false);
  const [uploadingSizeChart, setUploadingSizeChart] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>(data.values.categoryIds ?? []);
  const openLabelsAfterCreate = React.useRef(false);

  React.useEffect(() => () => {
    for (const url of pendingUrls.current) URL.revokeObjectURL(url);
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(adminProductSchema),
    defaultValues: data.values,
  });

  const name = form.watch('name');
  const sizeChartImage = form.watch('sizeChartImage');

  const save = form.handleSubmit(async (values) => {
    if (isNew && openLabelsAfterCreate.current && draftVariants.length === 0) {
      toast({ title: 'Add at least one variant with a SKU before creating labels.', variant: 'error' });
      return;
    }
    if (isNew && values.status === 'ACTIVE' && !draftVariants.some((variant) => variant.isActive)) {
      toast({ title: 'Add an active variant before publishing.', variant: 'error' });
      return;
    }

    const publishAfterImages = isNew && values.status === 'ACTIVE' && pendingImages.length > 0;
    const payload = {
      ...values,
      categoryIds: selectedCategories,
      ...(isNew ? { variants: draftVariants } : {}),
    };
    const res = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${data.id}`, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(publishAfterImages ? { ...payload, status: 'DRAFT' } : payload),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const issue = json?.error?.details?.[0]?.message;
      toast({ title: issue ?? json?.error?.message ?? 'Could not save the product.', variant: 'error' });
      return;
    }

    if (isNew) {
      try {
        if (pendingImages.length) {
          setUploading(true);
          await uploadImagesForProduct(json.id, pendingImages.map((image) => image.file));
        }
        if (publishAfterImages) {
          const publish = await fetch(`/api/admin/products/${json.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, categoryIds: selectedCategories }),
          });
          const result = await publish.json().catch(() => ({}));
          if (!publish.ok) throw new Error(result?.error?.message ?? 'Could not publish the product.');
        }
        toast({ title: 'Product, variants and images saved', variant: 'success' });
      } catch (err) {
        toast({
          title: 'Product and variants saved. Finish setup on the edit page.',
          description: err instanceof Error ? err.message : 'Retry the image upload or publishing there.',
          variant: 'error',
        });
      } finally {
        setUploading(false);
        router.push(openLabelsAfterCreate.current
          ? `/admin/products/${json.id}/labels`
          : `/admin/products/${json.id}`);
      }
    } else {
      toast({ title: 'Product saved', variant: 'success' });
      router.refresh();
    }
  });

  const uploadImagesForProduct = async (productId: string, files: File[]) => {
    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', 'products');
      body.append('name', slugify(name || 'product'));

      const upload = await fetch('/api/admin/media', { method: 'POST', body });
      const stored = await upload.json().catch(() => ({}));
      if (!upload.ok) throw new Error(stored?.error?.message ?? 'Upload failed.');

      const attach = await fetch(`/api/admin/products/${productId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: stored.url,
          blurDataUrl: stored.blurDataUrl,
          width: stored.width,
          height: stored.height,
          alt: name,
        }),
      });
      const image = await attach.json().catch(() => ({}));
      if (!attach.ok) throw new Error('Could not attach the image.');

      setImages((prev) => [
        ...prev.filter((i) => !i.isPlaceholder),
        { id: image.id, url: image.url, alt: image.alt, isPlaceholder: false, aiGenerated: false },
      ]);
    }
  };

  const uploadImages = async (files: FileList) => {
    if (isNew) {
      const staged = Array.from(files).map((file) => {
        const previewUrl = URL.createObjectURL(file);
        pendingUrls.current.add(previewUrl);
        return { key: crypto.randomUUID(), file, previewUrl };
      });
      setPendingImages((prev) => [...prev, ...staged]);
      return;
    }
    setUploading(true);

    try {
      await uploadImagesForProduct(data.id!, Array.from(files));
      toast({ title: 'Images uploaded', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  /**
   * Unlike gallery images, this is just a field on the product record — the
   * file uploads immediately, but the URL only saves when the form does, so
   * it can be set before the product itself has ever been saved.
   */
  const uploadSizeChart = async (file: File) => {
    setUploadingSizeChart(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('folder', 'size-charts');
      body.append('name', slugify(name || 'product'));

      const upload = await fetch('/api/admin/media', { method: 'POST', body });
      const stored = await upload.json().catch(() => ({}));
      if (!upload.ok) throw new Error(stored?.error?.message ?? 'Upload failed.');

      form.setValue('sizeChartImage', stored.url, { shouldDirty: true });
      toast({ title: 'Size chart uploaded — save the product to keep it', variant: 'success' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploadingSizeChart(false);
    }
  };

  /**
   * Clips upload one at a time and are stored byte for byte — nothing is
   * transcoded on this host, so what is uploaded here is what every shopper
   * downloads. Big files are the main risk, which is why the failure is
   * reported per file rather than swallowed.
   */
  const uploadVideos = async (files: FileList) => {
    if (!data.id) {
      toast({ title: 'Save the product first, then add videos.', variant: 'error' });
      return;
    }
    setUploadingVideo(true);

    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append('file', file);
        body.append('folder', 'product-videos');
        body.append('name', slugify(name || 'product'));

        const upload = await fetch('/api/admin/media/video', { method: 'POST', body });
        const stored = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(stored?.error?.message ?? 'Upload failed.');

        const attach = await fetch(`/api/admin/products/${data.id}/videos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: stored.url, alt: name }),
        });
        const video = await attach.json().catch(() => ({}));
        if (!attach.ok) throw new Error('Could not attach the video.');

        setVideos((prev) => [...prev, { id: video.id, url: video.url, posterUrl: null, alt: video.alt }]);
      }
      toast({ title: 'Video uploaded', variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Upload failed.', variant: 'error' });
    } finally {
      setUploadingVideo(false);
    }
  };

  const moveVideo = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= videos.length) return;
    const next = [...videos];
    [next[index], next[target]] = [next[target], next[index]];
    setVideos(next);
    void fetch(`/api/admin/products/${data.id}/videos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((v) => v.id) }),
    });
  };

  const removeVideo = async (videoId: string) => {
    const res = await fetch(`/api/admin/products/${data.id}/videos?videoId=${videoId}`, { method: 'DELETE' });
    if (res.ok) {
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      toast({ title: 'Video removed', variant: 'success' });
    } else {
      toast({ title: 'Could not remove that video.', variant: 'error' });
    }
  };

  const persistOrder = async (next: ProductImageRow[]) => {
    setImages(next);
    await fetch(`/api/admin/products/${data.id}/images`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    void persistOrder(next);
  };

  const removeImage = async (imageId: string) => {
    const res = await fetch(`/api/admin/products/${data.id}/images?imageId=${imageId}`, { method: 'DELETE' });
    if (res.ok) {
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      toast({ title: 'Image removed', variant: 'success' });
    } else {
      toast({ title: 'Could not remove that image.', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <Link href="/admin/products" className="text-2xs uppercase tracking-wide2 text-muted hover:text-ink hover:underline">
          ← Products
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">{isNew ? 'New product' : data.values.name}</h1>
          {!isNew && (
            <Link
              href={`/product/${data.values.slug}`}
              target="_blank"
              className="mt-1 inline-block text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              View on store ↗
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button asChild variant="outline">
              <Link href={`/admin/products/${data.id}/labels`}>
                <Barcode className="h-4 w-4" aria-hidden />
                Print barcode labels
              </Link>
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              className="text-muted hover:text-danger"
              onClick={async () => {
                // Named for what it does. It used to say "Archive", which is
                // also a status in the dropdown above that keeps the product
                // listed — this hides it from the store and from every tab but
                // Deleted, which is a different thing entirely.
                if (!window.confirm('Delete this product? It is removed from the store and can be restored from Products \u2192 Deleted.')) return;
                const res = await fetch(`/api/admin/products/${data.id}`, { method: 'DELETE' });
                if (res.ok) {
                  toast({
                    title: 'Product deleted',
                    description: 'Find it under Products \u2192 Deleted to restore it.',
                    variant: 'success',
                  });
                  router.push('/admin/products?deleted=1');
                }
              }}
            >
              Delete
            </Button>
          )}
          {isNew && (
            <Button
              variant="outline"
              onClick={() => {
                openLabelsAfterCreate.current = true;
                void save();
              }}
              loading={form.formState.isSubmitting || uploading}
            >
              <Barcode className="h-4 w-4" aria-hidden />
              Create & print labels
            </Button>
          )}
          <Button
            onClick={() => {
              openLabelsAfterCreate.current = false;
              void save();
            }}
            loading={form.formState.isSubmitting || uploading}
          >
            {isNew ? 'Create product' : 'Save changes'}
          </Button>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
        <div className="space-y-5">
          {/* ── Basics ────────────────────────────────────────────────── */}
          <section className="space-y-4 rounded-lg border border-line p-5">
            <h2 className="font-serif text-lg">Details</h2>

            <Field label="Product name" htmlFor="p-name" required error={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </Field>
            <Field label="Brand name" htmlFor="p-vendor" required error={form.formState.errors.vendor?.message}>
              <Input {...form.register('vendor')} />
            </Field>

            <Field
              label="URL slug"
              htmlFor="p-slug"
              hint={`/product/${form.watch('slug') || slugify(name || '')}`}
              error={form.formState.errors.slug?.message}
            >
              <Input placeholder={slugify(name || '')} {...form.register('slug')} />
            </Field>

            <Field label="Subtitle" htmlFor="p-subtitle">
              <Input {...form.register('subtitle')} />
            </Field>

            <Field
              label="Description"
              htmlFor="p-description"
              hint="HTML is supported. Imported products keep the original copy from the source store."
            >
              <Textarea rows={8} className="font-mono text-xs" {...form.register('description')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fabric" htmlFor="p-fabric" hint="e.g. Cotton Blend">
                <Input {...form.register('fabric')} />
              </Field>
              <Field label="Fit" htmlFor="p-fit" hint="e.g. Regular Fit">
                <Input {...form.register('fit')} />
              </Field>
            </div>

            <Field
              label="Size chart"
              htmlFor="p-size-chart"
              hint="Optional — a shirt and a kurta measure up differently. Falls back to the brand's default chart when not set."
            >
              <div className="flex items-center gap-3">
                {sizeChartImage && (
                  <Image
                    src={sizeChartImage}
                    alt=""
                    width={80}
                    height={52}
                    className="h-13 w-20 shrink-0 rounded border border-line object-cover"
                  />
                )}
                <label className="cursor-pointer">
                  <input
                    id="p-size-chart"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    disabled={uploadingSizeChart}
                    onChange={(e) => e.target.files?.[0] && uploadSizeChart(e.target.files[0])}
                  />
                  <span
                    className={`inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 ${
                      uploadingSizeChart ? 'opacity-50' : 'hover:border-ink'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    {uploadingSizeChart ? 'Uploading…' : sizeChartImage ? 'Replace' : 'Upload'}
                  </span>
                </label>
                {sizeChartImage && (
                  <button
                    type="button"
                    onClick={() => form.setValue('sizeChartImage', '', { shouldDirty: true })}
                    className="text-2xs uppercase tracking-wide2 text-muted hover:text-danger"
                  >
                    Remove
                  </button>
                )}
              </div>
            </Field>
          </section>

          {/* ── Images ────────────────────────────────────────────────── */}
          <section className="rounded-lg border border-line p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg">Images</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="sr-only"
                  disabled={uploading || form.formState.isSubmitting}
                  onChange={(e) => {
                    if (e.target.files) void uploadImages(e.target.files);
                    e.target.value = '';
                  }}
                />
                <span
                  className={`inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 ${
                    uploading || form.formState.isSubmitting ? 'opacity-50' : 'hover:border-ink'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden />
                  {uploading ? 'Uploading…' : 'Upload'}
                </span>
              </label>
            </div>

            {isNew && (
              <p className="mb-4 rounded-md bg-surface p-3 text-xs text-muted">
                Select images now. They will upload when you create the product, in the order shown below.
              </p>
            )}

            {isNew && pendingImages.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {pendingImages.map((image, i) => (
                  <li key={image.key} className="min-w-0">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-surface">
                      <Image src={image.previewUrl} alt={image.file.name} fill unoptimized sizes="160px" className="object-cover" />
                      {i === 0 && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-bg">Main</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-2xs text-muted" title={image.file.name}>{image.file.name}</p>
                    <div className="mt-1 flex justify-center gap-1">
                      <button type="button" disabled={i === 0} aria-label="Move image earlier"
                        onClick={() => setPendingImages((prev) => {
                          const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next;
                        })}
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button type="button" disabled={i === pendingImages.length - 1} aria-label="Move image later"
                        onClick={() => setPendingImages((prev) => {
                          const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next;
                        })}
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button type="button" aria-label="Remove image"
                        onClick={() => {
                          pendingUrls.current.delete(image.previewUrl);
                          URL.revokeObjectURL(image.previewUrl);
                          setPendingImages((prev) => prev.filter((item) => item.key !== image.key));
                        }}
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!isNew && images.length === 0 && (
              <p className="rounded-md border border-dashed border-line p-8 text-center text-xs text-muted">
                No images yet. Upload JPEG, PNG, WebP or AVIF — each is converted to WebP with
                responsive sizes automatically.
              </p>
            )}

            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((image, i) => (
                  <li key={image.id} className="group relative">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-surface">
                      {image.isPlaceholder || !image.url ? (
                        <span className="grid h-full place-items-center px-2 text-center text-[10px] uppercase tracking-wide text-faint">
                          Upload needed
                        </span>
                      ) : (
                        <Image src={image.url} alt={image.alt ?? ''} fill sizes="160px" className="object-cover" />
                      )}
                      {i === 0 && !image.isPlaceholder && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-bg">
                          Main
                        </span>
                      )}
                      {image.aiGenerated && (
                        <span
                          className="absolute right-1.5 top-1.5 rounded bg-gold px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white"
                          title="Imported from the source store's AI-generated files — replace with real photography"
                        >
                          AI
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex justify-center gap-1">
                      <button
                        type="button" onClick={() => move(i, -1)} disabled={i === 0}
                        aria-label="Move image earlier"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                        aria-label="Move image later"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button" onClick={() => removeImage(image.id)}
                        aria-label="Delete image"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Videos ───────────────────────────────────────────────── */}
          <section className="rounded-lg border border-line p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-serif text-lg">Videos</h2>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  multiple
                  className="sr-only"
                  disabled={isNew || uploadingVideo}
                  onChange={(e) => e.target.files && uploadVideos(e.target.files)}
                />
                <span
                  className={`inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 ${
                    isNew || uploadingVideo ? 'opacity-50' : 'hover:border-ink'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" aria-hidden />
                  {uploadingVideo ? 'Uploading…' : 'Upload'}
                </span>
              </label>
            </div>

            {isNew ? (
              <p className="rounded-md bg-surface p-3 text-xs text-muted">
                Save the product first — videos attach to an existing product.
              </p>
            ) : videos.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-8 text-center text-xs text-muted">
                No videos yet. Upload MP4 (H.264) or WebM — they appear at the end of the product
                gallery. Nothing is compressed here, so keep each clip small enough to load on
                mobile data.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {videos.map((video, i) => (
                  <li key={video.id}>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-ink">
                      <video
                        src={video.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="mt-1.5 flex justify-center gap-1">
                      <button
                        type="button" onClick={() => moveVideo(i, -1)} disabled={i === 0}
                        aria-label="Move video earlier"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button" onClick={() => moveVideo(i, 1)} disabled={i === videos.length - 1}
                        aria-label="Move video later"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button" onClick={() => removeVideo(video.id)}
                        aria-label="Delete video"
                        className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-surface hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Variants ──────────────────────────────────────────────── */}
          <VariantEditor
            productId={data.id}
            initial={data.variants}
            sizes={sizes}
            colors={colors}
            onChange={isNew ? setDraftVariants : undefined}
            defaultPrice={isNew ? Number(form.watch('price')) : undefined}
          />

          {/* ── SEO ───────────────────────────────────────────────────── */}
          <section className="space-y-4 rounded-lg border border-line p-5">
            <h2 className="font-serif text-lg">SEO</h2>
            <Field label="Meta title" htmlFor="p-metaTitle" hint="Falls back to the product name.">
              <Input {...form.register('metaTitle')} />
            </Field>
            <Field label="Meta description" htmlFor="p-metaDescription" hint="Around 155 characters.">
              <Textarea rows={3} {...form.register('metaDescription')} />
            </Field>
          </section>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <section className="space-y-4 rounded-lg border border-line p-5">
            <h2 className="font-serif text-lg">Publishing</h2>
            <Field label="Status" htmlFor="p-status">
              <select
                id="p-status"
                className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3 hover:border-ink/25 focus:border-ink"
                {...form.register('status')}
              >
                <option value="DRAFT">Draft — hidden from the store</option>
                <option value="ACTIVE">Active — live on the store</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-2xs uppercase tracking-wide2 text-muted">Merchandising</legend>
              {[
                { key: 'isFeatured' as const, label: 'Featured' },
                { key: 'isNewArrival' as const, label: 'New arrival' },
                { key: 'isBestSeller' as const, label: 'Best seller' },
              ].map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                  <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register(key)} />
                  {label}
                </label>
              ))}
            </fieldset>
          </section>

          <section className="space-y-4 rounded-lg border border-line p-5">
            <h2 className="font-serif text-lg">Pricing</h2>
            <p className="text-xs text-muted">
              This is the “from” price used on listing cards. Each variant carries the price actually charged.
            </p>
            <Field label="Price (Rs.)" htmlFor="p-price" required error={form.formState.errors.price?.message}>
              <Input type="number" step="0.01" min="0" {...form.register('price')} />
            </Field>
            <Field label="Compare-at price (Rs.)" htmlFor="p-compare" hint="Shown struck through. Leave blank if not on sale.">
              <Input type="number" step="0.01" min="0" {...form.register('compareAtPrice')} />
            </Field>
          </section>

          <section className="rounded-lg border border-line p-5">
            <h2 className="mb-3 font-serif text-lg">Collections</h2>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {categories.map((category) => (
                <li key={category.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1.5 text-sm text-muted hover:bg-surface">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={selectedCategories.includes(category.id)}
                      onChange={(e) =>
                        setSelectedCategories((prev) =>
                          e.target.checked ? [...prev, category.id] : prev.filter((id) => id !== category.id),
                        )
                      }
                    />
                    {category.name}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
