import { DatabaseState } from '../types/models';
import { createDemoDatabaseState } from './defaultSeedData';

const DB_NAME = 'BashaRentManagerOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'ledger_state';
const PRIMARY_KEY = 'singleton_state_v1';
const LOCAL_STORAGE_FALLBACK_KEY = 'basharent_offline_state_v1';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDatabaseState(): Promise<DatabaseState> {
  try {
    const db = await openIndexedDB();
    const state = await new Promise<DatabaseState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(PRIMARY_KEY);
      getReq.onsuccess = () => resolve(getReq.result as DatabaseState | undefined);
      getReq.onerror = () => reject(getReq.error);
    });
    if (state && state.schemaVersion) {
      return state;
    }
  } catch {
    // Fallback to localStorage if IndexedDB is restricted
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && parsed.schemaVersion) return parsed;
    }
  } catch {
    // ignore
  }

  const initial = createDemoDatabaseState();
  await saveDatabaseState(initial);
  return initial;
}

export async function saveDatabaseState(state: DatabaseState): Promise<void> {
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode
  }

  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(state, PRIMARY_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch {
    // Fallback already saved in localStorage
  }
}
