// src/types/ezoic.d.ts
declare global {
  interface Window {
    ezstandalone?: {
      cmd: Array<() => void>;
      consent?: boolean;
      [key: string]: any;
    };
  }
}

export {};