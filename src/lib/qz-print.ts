import type { QzApi } from 'qz-tray';

export const LABEL_PRINTER_KEY = 'cult.label-printer';
export const RECEIPT_PRINTER_KEY = 'cult.receipt-printer';
export const PRINTER_SELECTION_EVENT = 'cult-printer-selection';

let qzPromise: Promise<QzApi> | null = null;

async function qzApi(): Promise<QzApi> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then((loaded) => loaded.default);
  }
  return qzPromise;
}

export async function connectToWindowsPrinters(): Promise<QzApi> {
  const qz = await qzApi();
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 2, delay: 1 });
  return qz;
}

export async function listWindowsPrinters(): Promise<string[]> {
  const qz = await connectToWindowsPrinters();
  return qz.printers.find();
}

export function savedPrinter(key: string): string {
  return typeof window === 'undefined' ? '' : window.localStorage.getItem(key) ?? '';
}

export function savePrinter(key: string, value: string) {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new CustomEvent(PRINTER_SELECTION_EVENT, { detail: { key, value } }));
}

export async function printLabelHtml(printer: string, labels: string[]) {
  const qz = await connectToWindowsPrinters();
  const config = qz.configs.create(printer, {
    units: 'mm', size: { width: 50, height: 30 }, margins: 0,
    colorType: 'blackwhite', rasterize: true, scaleContent: false,
    jobName: `CULT product labels (${labels.length})`,
  });
  const css = `<style>
    @page{size:50mm 30mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}
    .product-label{width:50mm;height:30mm;padding:2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;text-align:center;break-after:page;page-break-after:always}
    .product-label:last-child{break-after:auto;page-break-after:auto}.product-label>strong:first-child{display:block;max-width:46mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;text-transform:uppercase}
    .product-label>span{display:block;max-width:46mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:9px}.product-label>strong:nth-of-type(2){font-size:12px}
    .product-label-barcode{display:block;max-width:46mm;width:auto;height:12mm}
  </style>`;
  await qz.print(config, labels.map((label) => ({
    type: 'pixel' as const, format: 'html' as const, flavor: 'plain' as const,
    data: `<!doctype html><html><head>${css}</head><body>${label}</body></html>`,
    options: { pageWidth: '50mm', pageHeight: '30mm' },
  })));
}

export async function printReceiptHtml(printer: string, receipt: string) {
  const qz = await connectToWindowsPrinters();
  const config = qz.configs.create(printer, {
    units: 'mm', size: { width: 80 }, margins: 3,
    colorType: 'blackwhite', rasterize: true, scaleContent: true,
    jobName: 'CULT offline receipt',
  });
  await qz.print(config, [{
    type: 'pixel', format: 'html', flavor: 'plain',
    data: `<!doctype html><html><head><style>@page{size:80mm auto;margin:3mm}html,body{margin:0;padding:0;background:#fff;color:#000}</style></head><body>${receipt}</body></html>`,
    options: { pageWidth: '74mm' },
  }]);
}
