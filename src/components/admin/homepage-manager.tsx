'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, ImageOff, Plus, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { HomepageSectionForm, type AdminHomepageSection } from './homepage-section-form';

export type { AdminHomepageSection };

/**
 * Homepage composition.
 *
 * Ordering is drag-and-drop using the native HTML5 drag events — no dependency
 * for one list — with arrow buttons alongside, because dragging is not
 * keyboard-accessible on its own.
 */
export function HomepageManager({
  sections: initial,
  canWrite,
}: {
  sections: AdminHomepageSection[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [sections, setSections] = React.useState(initial);
  const [editing, setEditing] = React.useState<AdminHomepageSection | 'new' | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [savingOrder, setSavingOrder] = React.useState(false);

  React.useEffect(() => setSections(initial), [initial]);

  const persistOrder = async (next: AdminHomepageSection[]) => {
    setSections(next);
    setSavingOrder(true);
    try {
      const res = await fetch('/api/admin/homepage/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast({ title: 'Could not save the new order.', variant: 'error' });
      setSections(initial);
    } finally {
      setSavingOrder(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length || from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  };

  const toggleActive = async (section: AdminHomepageSection) => {
    const res = await fetch(`/api/admin/homepage/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...section, isActive: !section.isActive }),
    });
    const json = await res.json().catch(() => ({}));
    toast(
      res.ok
        ? { title: section.isActive ? `“${section.title}” hidden` : `“${section.title}” is now live`, variant: 'success' }
        : { title: json?.error?.message ?? 'Could not update.', variant: 'error' },
    );
    if (res.ok) router.refresh();
  };

  const liveCount = sections.filter((s) => s.isActive).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {liveCount} of {sections.length} bands live
          {savingOrder && <span className="ml-2 text-2xs uppercase tracking-wide2 text-faint">saving order…</span>}
        </p>
        {canWrite && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            New section
          </Button>
        )}
      </div>

      <ol className="space-y-2">
        {sections.map((section, index) => {
          const missingArt = !section.desktopOnDisk && !section.videoUrl;

          return (
            <li
              key={section.id}
              draggable={canWrite}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-bg p-3 transition-colors',
                section.isActive ? 'border-line' : 'border-dashed border-line opacity-60',
                dragIndex === index && 'ring-2 ring-gold',
              )}
            >
              {canWrite && (
                <span className="cursor-grab text-faint active:cursor-grabbing" aria-hidden>
                  <GripVertical className="h-4 w-4" />
                </span>
              )}

              <span className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-surface">
                {section.desktopOnDisk && section.desktopImage ? (
                  <Image
                    src={section.desktopImage}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                    style={{ objectPosition: section.focalDesktop }}
                  />
                ) : (
                  <span className="grid h-full place-items-center text-faint">
                    <ImageOff className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{section.title}</span>
                  <code className="rounded bg-surface px-1.5 py-0.5 text-2xs text-muted">{section.key}</code>
                  {section.priority && (
                    <span className="rounded-full bg-ink px-2 py-0.5 text-2xs uppercase tracking-wide2 text-bg">
                      Hero
                    </span>
                  )}
                  {section.showProductRail && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-2xs uppercase tracking-wide2 text-muted">
                      + rail
                    </span>
                  )}
                  {section.comingSoon && (
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-2xs uppercase tracking-wide2 text-gold-ink">
                      Coming soon
                    </span>
                  )}
                </div>

                <p className="mt-0.5 truncate text-xs text-muted">{section.href}</p>

                {missingArt && (
                  <p className="mt-1 flex items-center gap-1 text-2xs text-gold-ink">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    Artwork not uploaded — a placeholder shows on the storefront
                  </p>
                )}
                {!missingArt && !section.mobileOnDisk && (
                  <p className="mt-1 flex items-center gap-1 text-2xs text-gold-ink">
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    No mobile crop — the landscape image is being reused on phones
                  </p>
                )}
              </div>

              {canWrite && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button" onClick={() => move(index, index - 1)} disabled={index === 0}
                    aria-label={`Move ${section.title} up`}
                    className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button" onClick={() => move(index, index + 1)} disabled={index === sections.length - 1}
                    aria-label={`Move ${section.title} down`}
                    className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-surface disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button" onClick={() => toggleActive(section)}
                    aria-label={section.isActive ? `Hide ${section.title}` : `Show ${section.title}`}
                    className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-surface"
                  >
                    {section.isActive ? <Eye className="h-3.5 w-3.5" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(section)}>Edit</Button>
                  <button
                    type="button"
                    aria-label={`Delete ${section.title}`}
                    onClick={async () => {
                      const res = await fetch(`/api/admin/homepage/${section.id}`, { method: 'DELETE' });
                      toast(res.ok
                        ? { title: 'Section deleted', variant: 'success' }
                        : { title: 'Could not delete.', variant: 'error' });
                      if (res.ok) router.refresh();
                    }}
                    className="grid h-8 w-8 place-items-center rounded text-faint hover:bg-surface hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-line p-10 text-center text-sm text-muted">
          No homepage sections yet.
        </p>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          title={editing === 'new' ? 'New homepage section' : 'Edit homepage section'}
          className="lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:max-w-xl lg:rounded-none"
        >
          {editing && (
            <HomepageSectionForm
              section={editing === 'new' ? null : editing}
              nextPosition={sections.length}
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
