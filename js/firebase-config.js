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
let isDarkMode = false;

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
        clients = [...new Set(accounts.map(a => a.client))].filter(Boolean);
        window.accounts = accounts;
        window.clients = clients;
        return accounts;
    } catch (error) {
        console.error('Error loading accounts:', error);
        throw error;
    }
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

// Batch operations
async function batchOperation(operations) {
    const batch = getDB().batch();
    operations.forEach(op => {
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

// Export
window.initFirebase = initFirebase;
window.getDB = getDB;
window.loadAccounts = loadAccounts;
window.saveAccount = saveAccount;
window.updateAccount = updateAccount;
window.deleteAccount = deleteAccount;
window.batchOperation = batchOperation;
window.accounts = accounts;
window.clients = clients;