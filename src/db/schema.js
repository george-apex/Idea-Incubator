export const DB_NAME = 'incubator_ideas_db';
export const DB_VERSION = 1;

export const STORES = {
  ideas: 'ideas',
  settings: 'settings',
  exports_log: 'exports_log'
};

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORES.ideas)) {
        const ideasStore = db.createObjectStore(STORES.ideas, { keyPath: 'id' });
        ideasStore.createIndex('status', 'status', { unique: false });
        ideasStore.createIndex('created_at', 'created_at', { unique: false });
        ideasStore.createIndex('next_review_at', 'next_review_at', { unique: false });
        ideasStore.createIndex('is_archived', 'is_archived', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains(STORES.exports_log)) {
        const exportsStore = db.createObjectStore(STORES.exports_log, { keyPath: 'id' });
        exportsStore.createIndex('exported_at', 'exported_at', { unique: false });
      }
    };
  });
}
