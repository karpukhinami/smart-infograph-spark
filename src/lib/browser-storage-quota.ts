import type { StateStorage } from "zustand/middleware";

/** Минимальный запас перед сохранением новой инфографики. */
export const MIN_FREE_FOR_NEW_IMAGE = 1024 * 1024;

const DEFAULT_QUOTA = 5 * 1024 * 1024;

type QuotaListener = () => void;
const quotaListeners = new Set<QuotaListener>();

export function onStorageQuotaExceeded(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

function emitStorageQuotaExceeded() {
  quotaListeners.forEach((fn) => fn());
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)
  );
}

export function estimateSessionStorageBytes(storage: Storage = sessionStorage): number {
  let total = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const val = storage.getItem(key) ?? "";
    total += (key.length + val.length) * 2;
  }
  return total;
}

export async function getBrowserStorageEstimate(): Promise<{
  used: number;
  quota: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ?? DEFAULT_QUOTA;
      const used = est.usage ?? estimateSessionStorageBytes();
      return { used, quota, remaining: Math.max(0, quota - used) };
    } catch {
      /* fallback below */
    }
  }
  const used = typeof sessionStorage !== "undefined" ? estimateSessionStorageBytes() : 0;
  const quota = DEFAULT_QUOTA;
  return { used, quota, remaining: Math.max(0, quota - used) };
}

export async function hasEnoughStorageForNewImage(): Promise<boolean> {
  const { remaining } = await getBrowserStorageEstimate();
  return remaining >= MIN_FREE_FOR_NEW_IMAGE;
}

export function createQuotaAwareSessionStorage(): StateStorage {
  const storage = sessionStorage;
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      try {
        storage.setItem(name, value);
      } catch (e) {
        if (isQuotaError(e)) emitStorageQuotaExceeded();
        throw e;
      }
    },
    removeItem: (name) => storage.removeItem(name),
  };
}
