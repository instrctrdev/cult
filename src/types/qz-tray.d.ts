declare module 'qz-tray' {
  type PrintConfig = Record<string, unknown>;
  type PrintData = {
    type: 'pixel' | 'raw';
    format: 'html' | 'image' | 'pdf' | 'command';
    flavor: 'plain' | 'base64' | 'file' | 'hex';
    data: string;
    options?: Record<string, unknown>;
  };

  export interface QzApi {
    websocket: {
      isActive(): boolean;
      connect(options?: { retries?: number; delay?: number }): Promise<void>;
    };
    printers: { find(): Promise<string[]> };
    configs: { create(printer: string, options?: Record<string, unknown>): PrintConfig };
    print(config: PrintConfig, data: PrintData[]): Promise<void>;
  }

  const qz: QzApi;
  export default qz;
}
