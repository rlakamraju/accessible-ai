// Minimal chrome.storage mock so extension code can run under vitest (no real browser APIs).
type StorageItems = Record<string, unknown>;

function createStorageArea() {
  const store = new Map<string, unknown>();
  return {
    async get(keyOrKeys?: string | string[]): Promise<StorageItems> {
      if (keyOrKeys === undefined) return Object.fromEntries(store);
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      return Object.fromEntries(keys.map((key) => [key, store.get(key)]));
    },
    async set(items: StorageItems): Promise<void> {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
    },
    async remove(keyOrKeys: string | string[]): Promise<void> {
      const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
      for (const key of keys) store.delete(key);
    },
  };
}

const chromeMock = {
  storage: {
    sync: createStorageArea(),
    local: createStorageArea(),
    session: createStorageArea(),
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
};

(globalThis as unknown as { chrome: typeof chromeMock }).chrome = chromeMock;
