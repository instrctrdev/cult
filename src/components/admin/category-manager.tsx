'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Field, Textarea } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { slugify, cn } from '@/lib/utils';

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
  showInNav: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  productCount: number;
}

type FormValues = Omit<AdminCategory, 'id' | 'productCount'>;

export function CategoryManager({
  categories,
  canWrite,
}: {
  categories: AdminCategory[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<AdminCategory | 'new' | null>(null);

  return (
    <>
      {canWrite && (
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden />
          New collection
        </Button>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-surface/50 text-left">
            <tr className="text-2xs uppercase tracking-wide2 text-muted">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Slug</th>
              <th className="p-3 font-medium">Products</th>
              <th className="p-3 font-medium">Visibility</th>
              <th className="p-3 font-medium">Order</th>
              {canWrite && <th className="p-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {categories.map((category) => (
              <tr key={category.id} className="transition-colors hover:bg-surface/40">
                <td className="p-3">
                  {canWrite ? (
                    <button onClick={() => setEditing(category)} className="text-ink hover:underline">
                      {category.name}
                    </button>
                  ) : (
                    <span className="text-ink">{category.name}</span>
                  )}
                </td>
                <td className="p-3 font-mono text-2xs text-faint">/{category.slug}</td>
                <td className="p-3 tabular-nums text-muted">{category.productCount}</td>
                <td className="p-3">
                  <span className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide2',
                        category.isActive ? 'bg-success/10 text-success' : 'bg-ink/[0.06] text-muted',
                      )}
                    >
                      {category.isActive ? 'Active' : 'Hidden'}
                    </span>
                    {category.showInNav && (
                      <span className="rounded-full bg-gold/10 px-2 py-0.5 text-2xs uppercase tracking-wide2 text-gold-ink">
                        In nav
                      </span>
                    )}
                  </span>
                </td>
                <td className="p-3 tabular-nums text-muted">{category.position}</td>
                {canWrite && (
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      aria-label={`Delete ${category.name}`}
                      onClick={async () => {
                        const res = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
                        const json = await res.json().catch(() => ({}));
                        toast(
                          res.ok
                            ? { title: 'Collection removed', variant: 'success' }
                            : { title: json?.error?.message ?? 'Could not delete.', variant: 'error' },
                        );
                        if (res.ok) router.refresh();
                      }}
                      className="grid h-8 w-8 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          title={editing === 'new' ? 'New collection' : 'Edit collection'}
          className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-md lg:rounded-none"
        >
          {editing && (
            <CategoryForm
              category={editing === 'new' ? null : editing}
              parents={categories.filter((c) => editing === 'new' || c.id !== editing.id)}
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

function CategoryForm({
  category, parents, onDone,
}: {
  category: AdminCategory | null;
  parents: AdminCategory[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      parentId: category?.parentId ?? null,
      position: category?.position ?? 0,
      isActive: category?.isActive ?? true,
      showInNav: category?.showInNav ?? false,
      metaTitle: category?.metaTitle ?? '',
      metaDescription: category?.metaDescription ?? '',
    },
  });

  const name = form.watch('name');

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        const res = await fetch(
          category ? `/api/admin/categories/${category.id}` : '/api/admin/categories',
          {
            method: category ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...values, parentId: values.parentId || null }),
          },
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ title: json?.error?.message ?? 'Could not save.', variant: 'error' });
          return;
        }
        toast({ title: category ? 'Collection updated' : 'Collection created', variant: 'success' });
        onDone();
      })}
      className="space-y-4 pb-4"
    >
      <Field label="Name" htmlFor="c-name" required>
        <Input {...form.register('name', { required: true })} />
      </Field>

      <Field label="URL slug" htmlFor="c-slug" hint={`/category/${form.watch('slug') || slugify(name || '')}`}>
        <Input placeholder={slugify(name || '')} {...form.register('slug')} />
      </Field>

      <Field label="Description" htmlFor="c-description">
        <Textarea rows={3} {...form.register('description')} />
      </Field>

      <Field label="Image URL" htmlFor="c-image" hint="Shown on the category rail. Upload via a product first, then paste the path.">
        <Input {...form.register('imageUrl')} />
      </Field>

      <Field label="Parent collection" htmlFor="c-parent">
        <select
          id="c-parent"
          className="h-12 w-full rounded-md border border-ink/15 bg-bg px-3"
          {...form.register('parentId')}
        >
          <option value="">None (top level)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>

      <Field label="Sort position" htmlFor="c-position" hint="Lower numbers appear first.">
        <Input type="number" min="0" {...form.register('position', { valueAsNumber: true })} />
      </Field>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('isActive')} />
          Visible on the storefront
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" {...form.register('showInNav')} />
          Show in the header menu
        </label>
      </div>

      <Button type="submit" size="lg" full loading={form.formState.isSubmitting}>
        {category ? 'Save changes' : 'Create collection'}
      </Button>
    </form>
  );
}
