// IndexedDB wrapper for file blobs — avoids localStorage 5MB quota
const DB_NAME = 'agent_files'
const DB_VERSION = 1
let db = null

function open() {
    if (db) return Promise.resolve(db)
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            req.result.createObjectStore('files', { keyPath: 'id' })
        }
        req.onsuccess = () => { db = req.result; resolve(db) }
        req.onerror = () => reject(req.error)
    })
}

export async function saveFile(id, blob) {
    const d = await open()
    return new Promise((resolve, reject) => {
        const tx = d.transaction('files', 'readwrite')
        tx.objectStore('files').put({ id, blob })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function loadFile(id) {
    const d = await open()
    return new Promise((resolve, reject) => {
        const tx = d.transaction('files', 'readonly')
        const req = tx.objectStore('files').get(id)
        req.onsuccess = () => resolve(req.result?.blob || null)
        req.onerror = () => reject(req.error)
    })
}

export async function deleteFile(id) {
    const d = await open()
    return new Promise((resolve, reject) => {
        const tx = d.transaction('files', 'readwrite')
        tx.objectStore('files').delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}
