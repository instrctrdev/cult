'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { BulkImportSummary } from '@/services/bulk-import.service';

/**
 * CSV (+ optional ZIP of images) bulk product import.
 *
 * Deliberately its own page and its own form state — nothing here reads
 * from or writes to the single-product create/edit form.
 */
export function BulkImportForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [zipFile, setZipFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<BulkImportSummary | null>(null);

  const submit = async () => {
    if (!csvFile) {
      toast({ title: 'Choose a CSV file first.', variant: 'error' });
      return;
    }
    setSubmitting(true);
    setSummary(null);
    try {
      const body = new FormData();
      body.append('csv', csvFile);
      if (zipFile) body.append('images', zipFile);

      const res = await fetch('/api/admin/products/bulk-import', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? 'Import failed.');

      setSummary(json);
      toast({
        title: `${json.created} product${json.created === 1 ? '' : 's'} created${json.failed ? `, ${json.failed} skipped` : ''}`,
        variant: json.failed && !json.created ? 'error' : 'success',
      });
      if (json.created > 0) router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Import failed.', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-lg border border-line p-5">
        <h2 className="mb-3 font-serif text-lg">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Download the template below (CSV or Excel — same columns either way) and fill in one row per product.</li>
          <li>
            <strong className="text-ink">variants</strong> packs size, colour and stock into one column:{' '}
            <code className="rounded bg-surface px-1 py-0.5 text-2xs">S:Black:20;M:Black:15;L:White:10</code>
          </li>
          <li>
            <strong className="text-ink">images</strong> lists filenames, comma-separated, matching files you put
            in the ZIP: <code className="rounded bg-surface px-1 py-0.5 text-2xs">shirt-1.jpg,shirt-2.jpg</code>
          </li>
          <li>Zip your product photos together (any folder structure — only the filename is matched) and upload both files here.</li>
          <li>Products are created as <strong className="text-ink">drafts</strong> unless the status column says otherwise — review and publish from the products list.</li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/api/admin/products/bulk-import/template?format=xlsx"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 hover:border-ink"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Excel template
          </Link>
          <Link
            href="/api/admin/products/bulk-import/template"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-ink/25 px-3 text-xs uppercase tracking-wide2 hover:border-ink"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV template
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-line p-5">
        <h2 className="font-serif text-lg">Upload</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink">Product sheet (CSV or Excel) *</span>
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border file:border-ink/25 file:bg-bg file:px-3 file:text-xs file:uppercase file:tracking-wide2 hover:file:border-ink"
            />
            {csvFile && <p className="mt-1 text-2xs text-muted">{csvFile.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink">Images ZIP (optional)</span>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:h-9 file:rounded-md file:border file:border-ink/25 file:bg-bg file:px-3 file:text-xs file:uppercase file:tracking-wide2 hover:file:border-ink"
            />
            {zipFile && <p className="mt-1 text-2xs text-muted">{zipFile.name}</p>}
          </label>
        </div>

        <Button onClick={submit} loading={submitting} disabled={!csvFile}>
          <Upload className="h-4 w-4" aria-hidden />
          Import products
        </Button>
      </section>

      {summary && (
        <section className="rounded-lg border border-line p-5">
          <h2 className="mb-3 font-serif text-lg">
            Result — {summary.created} created, {summary.failed} skipped
          </h2>
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {summary.results.map((r) => (
              <li key={r.row} className="flex items-start gap-2 text-sm">
                {r.status === 'created' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                )}
                <span>
                  <span className="text-2xs text-faint">Row {r.row}</span>{' '}
                  <span className="text-ink">{r.name}</span>
                  {r.status === 'created' && r.productId ? (
                    <>
                      {' — '}
                      <Link href={`/admin/products/${r.productId}`} className="text-2xs text-muted underline underline-offset-4 hover:text-ink">
                        edit
                      </Link>
                    </>
                  ) : (
                    <span className="block text-xs text-danger">{r.message}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
