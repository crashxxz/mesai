export interface StorageAdapter<T> {
  load: () => T | undefined;
  save: (value: T) => void;
}

export function createLocalStorageAdapter<T>(key: string): StorageAdapter<T> {
  return {
    load() {
      if (typeof window === "undefined") return undefined;
      const stored = window.localStorage.getItem(key);
      if (!stored) return undefined;
      return JSON.parse(stored) as T;
    },
    save(value) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  };
}
