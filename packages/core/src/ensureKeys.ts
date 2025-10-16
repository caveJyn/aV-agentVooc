import { stringToUuid } from "./uuid.ts";

export function ensureKeys<T extends object>(items: T[]): (T & { _key: string })[] {
    return items.map((item) => ({
      ...item,
      _key: (item as any)._key || stringToUuid(Date.now().toString() + Math.random().toString()),
    }));
  }