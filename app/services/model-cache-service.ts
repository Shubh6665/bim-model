// Simple IndexedDB wrapper for model caching
// Stores entries keyed by fileHash and by urn for fast lookup

export type CachedModel = {
  fileHash: string;
  fileName: string;
  size: number;
  urn: string;
  status: 'pending' | 'success' | 'failed';
  manifest?: any;
  createdAt: number;
  updatedAt: number;
  lastAccessAt: number;
  cacheHits: number;
};

const DB_NAME = 'bim-cache';
const DB_VERSION = 1;
const STORE_MODELS = 'models';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        const store = db.createObjectStore(STORE_MODELS, { keyPath: 'fileHash' });
        store.createIndex('urn', 'urn', { unique: true });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MODELS, mode);
    const store = tx.objectStore(STORE_MODELS);
    fn(store).then((res) => {
      tx.oncomplete = () => resolve(res);
      tx.onerror = () => reject(tx.error);
    }).catch(reject);
  });
}

export const modelCache = {
  // Hash helpers
  async sha256(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // CRUD
  async getByHash(fileHash: string): Promise<CachedModel | undefined> {
    return withStore('readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(fileHash);
        req.onsuccess = () => resolve(req.result as CachedModel | undefined);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async getByUrn(urn: string): Promise<CachedModel | undefined> {
    return withStore('readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const idx = store.index('urn');
        const req = idx.get(urn);
        req.onsuccess = () => resolve(req.result as CachedModel | undefined);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async upsert(entry: CachedModel): Promise<void> {
    entry.updatedAt = Date.now();
    return withStore('readwrite', async (store) => {
      return new Promise((resolve, reject) => {
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },

  async touchHit(fileHash: string): Promise<void> {
    const existing = await this.getByHash(fileHash);
    if (!existing) return;
    existing.cacheHits = (existing.cacheHits || 0) + 1;
    existing.lastAccessAt = Date.now();
    await this.upsert(existing);
  },

  async prune(maxEntries = 20): Promise<void> {
    // Keep the most recent by updatedAt, drop older ones
    const all: CachedModel[] = await withStore('readonly', async (store) => {
      return new Promise((resolve, reject) => {
        const items: CachedModel[] = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result as IDBCursorWithValue | null;
          if (cursor) {
            items.push(cursor.value as CachedModel);
            cursor.continue();
          } else {
            resolve(items);
          }
        };
        req.onerror = () => reject(req.error);
      });
    });

    if (all.length <= maxEntries) return;
    const toDelete = all.sort((a, b) => b.updatedAt - a.updatedAt).slice(maxEntries);

    await withStore('readwrite', async (store) => {
      await Promise.all(toDelete.map((e) => new Promise<void>((resolve, reject) => {
        const del = store.delete(e.fileHash);
        del.onsuccess = () => resolve();
        del.onerror = () => reject(del.error);
      })));
      return Promise.resolve();
    });
  }
};
