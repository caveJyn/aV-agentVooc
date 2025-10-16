// src/types/x-pixel.d.ts
export interface TwitterPixel {
  exe?: (...args: any[]) => void;
  queue: any[];
  version: string;
  (command: string, ...args: any[]): void;
}

declare global {
  interface Window {
    twq: TwitterPixel;
  }
}
