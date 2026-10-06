import JsBarcode from 'jsbarcode';

export const BLUETOOTH_PRINTER_EVENT = 'cult-bluetooth-printer';
const BLUETOOTH_SPP = 0x1101;
const DOTS_WIDE = 384; // P58D printable width: 48 mm at 203 dpi (8 dots/mm)
const DOTS_HIGH = 240; // 30 mm at 8 dots/mm

export type BluetoothLabel = {
  sku: string;
  name: string;
  brand: string;
  variant: string;
  mrp: string;
};

let activePort: SerialPort | null = null;

function isBluetoothPort(port: SerialPort) {
  const id = port.getInfo().bluetoothServiceClassId;
  return id === BLUETOOTH_SPP || id === '00001101-0000-1000-8000-00805f9b34fb';
}

export function supportsBluetoothPrinting() {
  return typeof navigator !== 'undefined' && Boolean(navigator.serial) && window.isSecureContext;
}

export async function permittedBluetoothPrinter(): Promise<SerialPort | null> {
  if (!navigator.serial) return null;
  if (activePort) return activePort;
  const ports = await navigator.serial.getPorts();
  activePort = ports.find(isBluetoothPort) ?? null;
  return activePort;
}

export async function chooseBluetoothPrinter(): Promise<SerialPort> {
  if (!navigator.serial) throw new Error('Bluetooth printing requires Chrome on Windows.');
  const port = await navigator.serial.requestPort({
    filters: [{ bluetoothServiceClassId: BLUETOOTH_SPP }],
  });
  activePort = port;
  window.dispatchEvent(new Event(BLUETOOTH_PRINTER_EVENT));
  return port;
}

function fitText(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > width) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function renderLabel(label: BluetoothLabel): Uint8Array {
  const canvas = document.createElement('canvas');
  canvas.width = DOTS_WIDE; canvas.height = DOTS_HIGH;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser could not render the label.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, DOTS_WIDE, DOTS_HIGH);
  context.fillStyle = '#000'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.font = '700 26px Arial'; context.fillText(fitText(context, label.brand.toUpperCase(), 360), DOTS_WIDE / 2, 25);
  context.font = '16px Arial'; context.fillText(fitText(context, `${label.name}${label.variant ? ` · ${label.variant}` : ''}`, 360), DOTS_WIDE / 2, 53);
  context.font = '700 22px Arial'; context.fillText(fitText(context, `MRP ${label.mrp}`, 360), DOTS_WIDE / 2, 79);

  const barcode = document.createElement('canvas');
  JsBarcode(barcode, label.sku, { format: 'CODE128', width: 2, height: 92, margin: 0, displayValue: true, fontSize: 18 });
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / barcode.width);
  const barcodeWidth = Math.round(barcode.width * scale);
  const barcodeHeight = Math.min(145, Math.round(barcode.height * scale));
  context.drawImage(barcode, (DOTS_WIDE - barcodeWidth) / 2, 92, barcodeWidth, barcodeHeight);

  const pixels = context.getImageData(0, 0, DOTS_WIDE, DOTS_HIGH).data;
  const bytesPerRow = Math.ceil(DOTS_WIDE / 8);
  const raster = new Uint8Array(bytesPerRow * DOTS_HIGH);
  for (let y = 0; y < DOTS_HIGH; y += 1) {
    for (let x = 0; x < DOTS_WIDE; x += 1) {
      const offset = (y * DOTS_WIDE + x) * 4;
      const luminance = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
      if (pixels[offset + 3] > 0 && luminance < 170) raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return raster;
}

function escPosRaster(data: Uint8Array) {
  const bytesPerRow = Math.ceil(DOTS_WIDE / 8);
  const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, DOTS_HIGH & 0xff, DOTS_HIGH >> 8]);
  const command = new Uint8Array(header.length + data.length + 1);
  command.set(header); command.set(data, header.length); command[command.length - 1] = 0x0c; // form feed to next label
  return command;
}

export async function printBluetoothLabels(labels: BluetoothLabel[]) {
  const port = activePort ?? await permittedBluetoothPrinter();
  if (!port) throw new Error('Connect the P58D Bluetooth printer first.');
  if (!port.writable) await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
  if (!port.writable) throw new Error('The P58D Bluetooth connection did not open.');
  const writer = port.writable.getWriter();
  try {
    await writer.write(new Uint8Array([0x1b, 0x40])); // ESC @ initialize
    for (const label of labels) await writer.write(escPosRaster(renderLabel(label)));
  } finally {
    writer.releaseLock();
    await port.close().catch(() => undefined);
  }
}
