import { openDatabase, STORES } from './schema.js';

let db = null;

export async function initDB() {
  if (db) return db;
  db = await openDatabase();
  return db;
}

export async function getAllIdeas() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readonly');
    const store = transaction.objectStore(STORES.ideas);
    const request = store.getAll();
    
    request.onsuccess = () => {
      console.log('DB - Loaded ideas from database:', request.result.map(i => ({ title: i.title, pos: i.canvas_pos })));
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getIdea(id) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readonly');
    const store = transaction.objectStore(STORES.ideas);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveIdea(idea) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readwrite');
    const store = transaction.objectStore(STORES.ideas);
    const request = store.put(idea);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteIdea(id) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readwrite');
    const store = transaction.objectStore(STORES.ideas);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getDueIdeas() {
  await initDB();
  const now = Date.now();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readonly');
    const store = transaction.objectStore(STORES.ideas);
    const index = store.index('next_review_at');
    const request = index.openCursor(IDBKeyRange.upperBound(now));
    
    const results = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (!cursor.value.is_archived) {
          results.push(cursor.value);
        }
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

export async function getSettings() {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.settings, 'readonly');
    const store = transaction.objectStore(STORES.settings);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const settings = {};
      request.result.forEach(item => {
        settings[item.key] = item.value;
      });
      resolve(settings);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveSetting(key, value) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.settings, 'readwrite');
    const store = transaction.objectStore(STORES.settings);
    const request = store.put({ key, value });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function bulkSaveIdeas(ideas) {
  await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.ideas, 'readwrite');
    const store = transaction.objectStore(STORES.ideas);
    
    ideas.forEach(idea => {
      store.put(idea);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
