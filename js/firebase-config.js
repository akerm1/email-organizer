// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDznYcUtQWRD7QqYBDr1QupUMfVqZnfGEE",
    authDomain: "my-work-82778.firebaseapp.com",
    projectId: "my-work-82778",
    storageBucket: "my-work-82778.appspot.com",
    messagingSenderId: "1070444118182",
    appId: "1:1070444118182:web:bae373255bd124d3a2b467"
};

// Initialize Firebase
let db = null;
let accounts = [];
let clients = [];
let clientsMeta = [];
let isDarkMode = false;

// Recompute the client list as the union of saved clients + client names on accounts
function syncClients() {
    const metaNames = clientsMeta.map(c => c.name);
    const accountNames = accounts.map(a => a.client);
    clients = [...new Set([...metaNames, ...accountNames])].filter(Boolean).sort();
    window.clients = clients;
}

function initFirebase() {
    return new Promise((resolve, reject) => {
        try {
            if (typeof firebase !== 'undefined' && !firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            
            // Enable offline persistence
            db.enablePersistence({ synchronizeTabs: true })
                .catch((err) => {
                    console.warn('Firestore persistence:', err);
                });
            
            resolve(db);
        } catch (error) {
            reject(error);
        }
    });
}

// Get Firestore instance
function getDB() {
    if (!db) {
        throw new Error('Firebase not initialized');
    }
    return db;
}

// Load accounts from Firestore
async function loadAccounts() {
    try {
        const snapshot = await getDB().collection('accounts').get();
        accounts = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            accounts.push({
                id: doc.id,
                client: data.client || '',
                email: data.email || '',
                date: data.date || '',
                replacementEmail: data.replacementEmail || '',
                hasProblem: data.hasProblem || false,
                problemNote: data.problemNote || '',
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null
            });
        });
        syncClients();
        window.accounts = accounts;
        window.clientsMeta = clientsMeta;
        return accounts;
    } catch (error) {
        console.error('Error loading accounts:', error);
        throw error;
    }
}

// Load saved clients (independent of accounts)
async function loadClients() {
    try {
        const snapshot = await getDB().collection('clients').get();
        clientsMeta = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            clientsMeta.push({
                id: doc.id,
                name: data.name || ''
            });
        });
        syncClients();
        window.clientsMeta = clientsMeta;
        return clientsMeta;
    } catch (error) {
        console.warn('Error loading clients:', error);
        return [];
    }
}

// Add a standalone client (no accounts needed)
async function addClient(name) {
    const docRef = await getDB().collection('clients').add({
        name: String(name).trim(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    clientsMeta.push({ id: docRef.id, name: String(name).trim() });
    syncClients();
    return docRef.id;
}

// Rename a client across the clients collection and all its accounts
async function renameClient(oldName, newName) {
    newName = String(newName).trim();
    if (!newName || newName === oldName) return;

    const meta = clientsMeta.find(c => c.name === oldName);
    const operations = [];
    if (meta) {
        operations.push({
            type: 'update',
            ref: getDB().collection('clients').doc(meta.id),
            data: { name: newName, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
        });
    }
    const affected = accounts.filter(a => a.client === oldName);
    affected.forEach(a => {
        operations.push({
            type: 'update',
            ref: getDB().collection('accounts').doc(a.id),
            data: { client: newName, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
        });
    });

    if (operations.length) await batchOperation(operations);

    if (meta) meta.name = newName;
    affected.forEach(a => a.client = newName);
    syncClients();
}

// Delete a client record; when withAccounts is true, delete its accounts too
async function deleteClient(name, withAccounts = false) {
    const meta = clientsMeta.find(c => c.name === name);
    const operations = [];
    if (meta) {
        operations.push({ type: 'delete', ref: getDB().collection('clients').doc(meta.id) });
    }
    if (withAccounts) {
        accounts.filter(a => a.client === name).forEach(a => {
            operations.push({ type: 'delete', ref: getDB().collection('accounts').doc(a.id) });
        });
    }

    if (operations.length) await batchOperation(operations);

    clientsMeta = clientsMeta.filter(c => c.name !== name);
    if (withAccounts) {
        accounts = accounts.filter(a => a.client !== name);
    }
window.accounts = accounts;
    window.clientsMeta = clientsMeta;
    syncClients();
}

// Save account
async function saveAccount(accountData) {
    const docRef = await getDB().collection('accounts').add({
        ...accountData,
        date: String(accountData.date),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
}

// Update account
async function updateAccount(id, accountData) {
    await getDB().collection('accounts').doc(id).update({
        ...accountData,
        date: String(accountData.date),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Delete account
async function deleteAccount(id) {
    await getDB().collection('accounts').doc(id).delete();
}

// Batch operations (auto-chunked to stay under Firestore's 500-write limit)
async function batchOperation(operations) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        const batch = getDB().batch();
        operations.slice(i, i + CHUNK_SIZE).forEach(op => {
            if (op.type === 'set') {
                batch.set(op.ref, op.data);
            } else if (op.type === 'update') {
                batch.update(op.ref, op.data);
            } else if (op.type === 'delete') {
                batch.delete(op.ref);
            }
        });
        await batch.commit();
    }
}

// Export
window.initFirebase = initFirebase;
window.getDB = getDB;
window.loadAccounts = loadAccounts;
window.loadClients = loadClients;
window.saveAccount = saveAccount;
window.updateAccount = updateAccount;
window.deleteAccount = deleteAccount;
window.batchOperation = batchOperation;
window.addClient = addClient;
window.renameClient = renameClient;
window.deleteClient = deleteClient;
window.syncClients = syncClients;
window.accounts = accounts;
window.clients = clients;
window.clientsMeta = clientsMeta;