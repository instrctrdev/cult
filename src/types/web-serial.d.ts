interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
}

interface SerialPort {
  /** Chrome 130+: whether the Bluetooth RFCOMM device is logically present. */
  readonly connected?: boolean;
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): SerialPortInfo;
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: 'none' | 'even' | 'odd'; bufferSize?: number; flowControl?: 'none' | 'hardware' }): Promise<void>;
  close(): Promise<void>;
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
}

interface Serial {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: {
    filters?: SerialPortFilter[];
    allowedBluetoothServiceClassIds?: Array<number | string>;
  }): Promise<SerialPort>;
  addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void;
}

interface Navigator { readonly serial?: Serial; }
