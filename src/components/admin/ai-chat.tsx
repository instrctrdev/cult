'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  createdAt?: string;
}

interface PendingAction {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  risk: 'write-low' | 'write-high';
}

interface ImportRowResult {
  row: number;
  name: string;
  status: 'created' | 'error';
  message?: string;
}

interface ImportSummary {
  created: number;
  failed: number;
  results: ImportRowResult[];
}

/** A row in the importer's own column shape, prepared by the assistant. */
type PlannedRow = Record<string, string>;

interface ProductPlan {
  rows: PlannedRow[];
  problems: string[];
}

const SUGGESTED_PROMPTS = [
  "Show today's orders",
  'Which products are low in stock?',
  'Show best selling products',
  "Show this month's sales",
];

const IMPORT_EXTENSIONS = /\.(csv|xlsx|xls)$/i;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AiChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportSummary | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [productPlan, setProductPlan] = useState<ProductPlan | null>(null);
  /** Filenames read from the attached ZIP, so the assistant can match them. */
  const [zipFiles, setZipFiles] = useState<string[]>([]);
  const [zipReading, setZipReading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/ai/history')
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json?.messages)) setMessages(json.messages);
      })
      .catch(() => {});
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || pendingAction) return;

    const next: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(next);
    setInput('');
    setPending(true);

    try {
      // The attached ZIP's filenames ride along with the message rather than
      // being shown in the chat: the model needs them to match photos to
      // products, but they are noise to read.
      const outgoing = next.map((m) => ({ role: m.role, text: m.text }));
      if (zipFiles.length && outgoing.length) {
        const last = outgoing[outgoing.length - 1];
        if (last.role === 'user') {
          last.text = `${last.text}\n\n[Attached ZIP contains these image files: ${zipFiles.join(', ')}]`;
        }
      }

      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: outgoing }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast({ title: json?.error ?? 'The assistant could not answer that.', variant: 'error' });
        return;
      }

      if (json.pendingAction) {
        setPendingAction(json.pendingAction);
        return;
      }

      if (json.productPlan?.rows?.length) setProductPlan(json.productPlan);

      setMessages([...next, { role: 'model', text: json.text || "I don't have an answer for that." }]);
    } catch {
      toast({ title: 'Could not reach the assistant — check your connection.', variant: 'error' });
    } finally {
      setPending(false);
      scrollToBottom();
    }
  }

  async function resolveAction(confirmed: boolean) {
    if (!pendingAction) return;

    setActionBusy(true);
    try {
      const res = await fetch('/api/admin/ai/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pendingAction.name, args: pendingAction.args, cancelled: !confirmed }),
      });
      const json = await res.json().catch(() => ({}));

      const text = !confirmed
        ? `Cancelled: ${json.summary ?? pendingAction.summary}`
        : json.ok
          ? `Done — ${json.summary}`
          : `Couldn't do it — ${json.summary} — ${json.error ?? 'unknown error'}`;
      setMessages((m) => [...m, { role: 'model', text }]);
      if (confirmed && !json.ok) toast({ title: json.error ?? 'That action failed.', variant: 'error' });
    } catch {
      toast({ title: 'Could not reach the server to confirm that action.', variant: 'error' });
    } finally {
      setActionBusy(false);
      setPendingAction(null);
      scrollToBottom();
    }
  }

  function pickFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const f of Array.from(fileList)) {
      if (IMPORT_EXTENSIONS.test(f.name)) setSheetFile(f);
      else if (/\.zip$/i.test(f.name)) {
        setZipFile(f);
        void readZipFilenames(f);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /** Only the names are read; the photos themselves never leave the server. */
  async function readZipFilenames(zip: File) {
    setZipReading(true);
    setZipFiles([]);
    try {
      const form = new FormData();
      form.set('images', zip);
      const res = await fetch('/api/admin/ai/import/inspect', { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      const files: string[] = Array.isArray(json?.files) ? json.files : [];
      setZipFiles(files);

      // Silence here used to look like "the ZIP was attached fine" while the
      // assistant was never told a single filename — so it is said out loud.
      if (!res.ok || files.length === 0) {
        toast({
          title: 'Could not read any images from that ZIP',
          description: res.ok
            ? 'It contains no .jpg, .png or .webp files at the top level.'
            : 'Reload the page and attach it again — this usually means the page is running an older version.',
          variant: 'error',
        });
      }
    } catch {
      setZipFiles([]);
      toast({ title: 'Could not read that ZIP.', description: 'Reload the page and try attaching it again.', variant: 'error' });
    } finally {
      setZipReading(false);
    }
  }

  /** Creates the products the admin just checked, through the normal importer. */
  async function createPlanned() {
    if (!productPlan?.rows.length) return;
    setImportBusy(true);
    try {
      const form = new FormData();
      form.set('payload', JSON.stringify({ rows: productPlan.rows }));
      if (zipFile) form.set('images', zipFile);

      const res = await fetch('/api/admin/ai/import/create', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json?.error?.message ?? 'Could not create those products.', variant: 'error' });
        return;
      }

      const failures = (json.results ?? []).filter((r: ImportRowResult) => r.status === 'error');
      setMessages((m) => [
        ...m,
        {
          role: 'model',
          text:
            `Created ${json.created} product${json.created === 1 ? '' : 's'} as drafts.` +
            (json.failed ? `\n${json.failed} failed:\n` + failures.map((f: ImportRowResult) => `• ${f.name}: ${f.message}`).join('\n') : ''),
        },
      ]);
      toast({
        title: `Created ${json.created} product${json.created === 1 ? '' : 's'}`,
        description: 'They are drafts — review and publish them in Products.',
        variant: 'success',
      });
      setProductPlan(null);
      setZipFile(null);
      setZipFiles([]);
    } catch {
      toast({ title: 'Could not reach the server to create those products.', variant: 'error' });
    } finally {
      setImportBusy(false);
      scrollToBottom();
    }
  }

  async function previewImport() {
    if (!sheetFile) return;
    setImportBusy(true);
    setImportPreview(null);
    try {
      const form = new FormData();
      form.set('csv', sheetFile);
      if (zipFile) form.set('images', zipFile);

      const res = await fetch('/api/admin/ai/import/preview', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json?.error?.message ?? 'Could not validate that file.', variant: 'error' });
        return;
      }
      setImportPreview(json);
    } catch {
      toast({ title: 'Could not reach the server to validate that file.', variant: 'error' });
    } finally {
      setImportBusy(false);
      scrollToBottom();
    }
  }

  async function commitImport() {
    if (!sheetFile) return;
    setImportBusy(true);
    try {
      const form = new FormData();
      form.set('csv', sheetFile);
      if (zipFile) form.set('images', zipFile);

      const res = await fetch('/api/admin/ai/import/commit', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json?.error?.message ?? 'The import failed.', variant: 'error' });
        return;
      }
      setMessages((m) => [
        ...m,
        { role: 'user', text: `Import ${sheetFile.name}${zipFile ? ` + ${zipFile.name}` : ''}` },
        { role: 'model', text: `Imported ${json.created} product${json.created === 1 ? '' : 's'}, ${json.failed} failed.` },
      ]);
      toast({ title: `Imported ${json.created} products.`, variant: 'success' });
    } catch {
      toast({ title: 'Could not reach the server to run that import.', variant: 'error' });
    } finally {
      setImportBusy(false);
      setImportPreview(null);
      setSheetFile(null);
      setZipFile(null);
      scrollToBottom();
    }
  }

  let lastDay = '';

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-line bg-surface">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && !pendingAction && !importPreview && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:bg-bg"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const day = m.createdAt ? dayLabel(m.createdAt) : '';
          const showDivider = day && day !== lastDay;
          if (showDivider) lastDay = day;
          return (
            <div key={i}>
              {showDivider && <p className="mb-3 text-center text-xs text-faint">{day}</p>}
              <div className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] rounded-lg bg-ink px-4 py-2 text-sm text-white'
                      : 'max-w-[80%] whitespace-pre-wrap rounded-lg border border-line bg-bg px-4 py-2 text-sm text-ink'
                  }
                >
                  {m.text}
                </div>
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Thinking…
          </div>
        )}

        {pendingAction && (
          <div className="max-w-[90%] space-y-3 rounded-lg border border-line bg-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {pendingAction.risk === 'write-high' ? 'Confirm — bulk change' : 'Confirm this change'}
            </p>
            <p className="text-sm text-ink">{pendingAction.summary}</p>
            <div className="flex gap-2">
              <Button size="sm" loading={actionBusy} onClick={() => resolveAction(true)}>
                Confirm
              </Button>
              <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => resolveAction(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {productPlan && (
          <div className="max-w-full space-y-3 rounded-lg border border-line bg-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Confirm — create products</p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-line text-2xs uppercase tracking-wide2 text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Product</th>
                    <th className="py-1.5 pr-3 font-medium">Price</th>
                    <th className="py-1.5 pr-3 font-medium">Sizes &amp; stock</th>
                    <th className="py-1.5 pr-3 font-medium">Category</th>
                    <th className="py-1.5 font-medium">Images</th>
                  </tr>
                </thead>
                <tbody>
                  {productPlan.rows.map((r) => (
                    <tr key={r.slug} className="border-b border-line last:border-0 align-top">
                      <td className="py-2 pr-3 text-ink">{r.name}</td>
                      <td className="py-2 pr-3 tabular-nums">Rs. {r.price}</td>
                      <td className="py-2 pr-3 text-muted">{r.variants.replace(/;/g, ', ')}</td>
                      <td className="py-2 pr-3 text-muted">{r.categories || '—'}</td>
                      <td className="py-2 text-muted">{r.images ? r.images.replace(/,/g, ', ') : 'none'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {productPlan.problems.length > 0 && (
              <ul className="space-y-1 text-xs text-muted">
                {productPlan.problems.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            )}

            <p className="text-xs text-muted">
              Created as drafts — nothing goes on sale until you publish it in Products.
            </p>

            <div className="flex gap-2">
              <Button size="sm" loading={importBusy} onClick={createPlanned}>
                Create {productPlan.rows.length} product{productPlan.rows.length === 1 ? '' : 's'}
              </Button>
              <Button size="sm" variant="outline" disabled={importBusy} onClick={() => setProductPlan(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {importPreview && (
          <div className="max-w-[90%] space-y-3 rounded-lg border border-line bg-bg p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Confirm — bulk import</p>
            <p className="text-sm text-ink">
              Will create <strong>{importPreview.created}</strong> product{importPreview.created === 1 ? '' : 's'}
              {importPreview.failed > 0 && (
                <>
                  {' '}— <strong>{importPreview.failed}</strong> row{importPreview.failed === 1 ? '' : 's'} will fail
                </>
              )}
              .
            </p>
            {importPreview.failed > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted">
                {importPreview.results
                  .filter((r) => r.status === 'error')
                  .slice(0, 10)
                  .map((r) => (
                    <li key={r.row}>Row {r.row} ({r.name}): {r.message}</li>
                  ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={importBusy}
                disabled={importPreview.created === 0}
                onClick={commitImport}
              >
                Import {importPreview.created} product{importPreview.created === 1 ? '' : 's'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={importBusy}
                onClick={() => {
                  setImportPreview(null);
                  setSheetFile(null);
                  setZipFile(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {(sheetFile || zipFile) && !importPreview && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 pt-3">
          {sheetFile && (
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1 text-xs text-ink">
              {sheetFile.name}
              <button type="button" onClick={() => setSheetFile(null)} aria-label="Remove file">
                <X className="size-3" />
              </button>
            </span>
          )}
          {zipFile && (
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1 text-xs text-ink">
              {zipFile.name}
              {zipReading ? ' · reading…' : zipFiles.length ? ` · ${zipFiles.length} images` : ' · no images found'}
              <button type="button" onClick={() => { setZipFile(null); setZipFiles([]); }} aria-label="Remove file">
                <X className="size-3" />
              </button>
            </span>
          )}
          {sheetFile && (
            <Button size="sm" variant="outline" loading={importBusy} onClick={previewImport}>
              Preview import
            </Button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-line p-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.zip"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Attach a product CSV/Excel sheet, optionally with a ZIP of images"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="size-4" />
        </Button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about orders, products, inventory, coupons, customers, or sales…"
          rows={1}
          className="min-h-0 flex-1 resize-none"
        />
        <Button type="submit" size="icon" loading={pending} disabled={!input.trim() || Boolean(pendingAction)}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
