// src/storage/db.js

const DB_NAME = 'RoadTripDB';
const DB_VERSION = 1;
const TRIP_STORE_NAME = 'trips';
const VIDEO_CHUNK_STORE_NAME = 'videoChunks';

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(TRIP_STORE_NAME)) {
        db.createObjectStore(TRIP_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(VIDEO_CHUNK_STORE_NAME)) {
        db.createObjectStore(VIDEO_CHUNK_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error("IndexedDB error:", event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

export async function addTrip(trip) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRIP_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TRIP_STORE_NAME);
    const request = store.add(trip);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateTrip(trip) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRIP_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TRIP_STORE_NAME);
    const request = store.put(trip);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getTrips() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRIP_STORE_NAME], 'readonly');
    const store = transaction.objectStore(TRIP_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addVideoChunk(chunk) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([VIDEO_CHUNK_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(VIDEO_CHUNK_STORE_NAME);
    const request = store.add(chunk);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getVideoChunks() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([VIDEO_CHUNK_STORE_NAME], 'readonly');
    const store = transaction.objectStore(VIDEO_CHUNK_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearVideoChunks() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([VIDEO_CHUNK_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(VIDEO_CHUNK_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTrip(id) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRIP_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TRIP_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearTrips() {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([TRIP_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(TRIP_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteVideoFromOpfs(filename) {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(filename);
    console.log(`Deleted ${filename} from OPFS`);
    return true;
  } catch (error) {
    console.error("Error deleting from OPFS:", error);
    return false;
  }
}

// OPFS (Origin Private File System) helpers for larger video files
// This is a simplified example. Real-world OPFS usage for large files
// would involve more complex stream writing and reading.
export async function writeVideoToOpfs(filename, blob) {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    console.log(`Successfully wrote ${filename} to OPFS.`);
    return true;
  } catch (error) {
    console.error("Error writing to OPFS:", error);
    return false;
  }
}

export async function readVideoFromOpfs(filename) {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file;
  } catch (error) {
    console.error("Error reading from OPFS:", error);
    return null;
  }
}
