// ============================================
// EMAIL EXPIRY CHECKER - Telegram Notifications
// ============================================

const admin = require('firebase-admin');
const webpush = require('web-push');

// ============================================
// CONFIGURATION - Notification at 9:46 AM Algeria time
// ============================================
const ALGERIA_OFFSET = 1; // UTC+1 (Algeria time)

// Web Push (phone notifications) - keys come from GitHub Actions secrets
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@emailvault.app';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Notification Settings
const NOTIFY_DAYS_BEFORE = 30; // Send notification for emails expiring within X days
const NOTIFY_EXPIRED = true; // Send notification for expired emails
const NOTIFY_TODAY = true; // Send notification for emails expiring today
const NOTIFY_HOUR = 9; // Hour in Algeria time (9 AM)
const NOTIFY_MINUTE = 46; // Minute in Algeria time (46 minutes)

// ============================================
// FIREBASE INIT
// ============================================
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT is not set');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
    console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getAlgeriaDate() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + ALGERIA_OFFSET * 3600000);
}

function extractDay(dateValue) {
    if (!dateValue) return null;
    const num = parseInt(dateValue, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) return num;
    return null;
}

function getDaysUntilExpiry(dayValue) {
    const day = extractDay(dayValue);
    if (day === null) return null;
    
    const today = getAlgeriaDate();
    today.setHours(0, 0, 0, 0);
    
    const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(day, lastDayThisMonth);
    const thisMonthDate = new Date(today.getFullYear(), today.getMonth(), clampedDay);
    
    if (thisMonthDate >= today) {
        return Math.round((thisMonthDate - today) / (1000 * 60 * 60 * 24));
    }
    
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
    const clampedDayNext = Math.min(day, lastDayNextMonth);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, clampedDayNext);
    return Math.round((nextMonth - today) / (1000 * 60 * 60 * 24));
}

function getTodayKey() {
    const now = getAlgeriaDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getCurrentTimeAlgeria() {
    const now = getAlgeriaDate();
    return {
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        full: now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' })
    };
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================
async function wasNotifiedToday(accountId, todayKey) {
    try {
        const doc = await db.collection('notificationLog').doc(accountId).get();
        if (!doc.exists) return false;
        return doc.data().lastNotified === todayKey;
    } catch {
        return false;
    }
}

async function markNotified(accountId, todayKey) {
    await db.collection('notificationLog').doc(accountId).set({
        lastNotified: todayKey,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function sendTelegramMessage(message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
        console.error('❌ Telegram credentials missing');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ Telegram error: ${error}`);
            return false;
        }
        
        console.log('✅ Telegram message sent');
        return true;
    } catch (error) {
        console.error(`❌ Telegram failed: ${error.message}`);
        return false;
    }
}

async function sendNotificationMessage(accounts, type) {
    if (!accounts || accounts.length === 0) return;
    
    const now = getAlgeriaDate();
    const dateStr = now.toLocaleDateString('en-US', { 
        timeZone: 'Africa/Algiers',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const titles = {
        expired: '🔴 Email Accounts EXPIRED',
        today: '🟡 Email Accounts Expire TODAY',
        upcoming: `🟠 Email Accounts Expiring in ${NOTIFY_DAYS_BEFORE} Days`
    };
    
    let message = `📧 <b>${titles[type]}</b>\n`;
    message += `📅 ${dateStr}\n`;
    message += `⏰ ${now.toLocaleTimeString('en-US', { timeZone: 'Africa/Algiers' })}\n`;
    message += `━${'━'.repeat(20)}━\n\n`;
    
    // Group by client
    const grouped = {};
    accounts.forEach(a => {
        if (!grouped[a.client]) grouped[a.client] = [];
        grouped[a.client].push(a);
    });
    
    Object.keys(grouped).sort().forEach(client => {
        message += `<b>📁 ${client}</b> (${grouped[client].length})\n`;
        grouped[client].forEach(a => {
            const days = getDaysUntilExpiry(a.date);
            const emoji = days < 0 ? '🔴' : days === 0 ? '🟡' : '🟠';
            const status = days < 0 ? 'EXPIRED' : days === 0 ? 'TODAY' : `${days}d left`;
            const replacement = a.replacementEmail ? ` → ${a.replacementEmail}` : '';
            message += `  ${emoji} <code>${a.email}</code>${replacement}\n`;
            message += `     📅 Day ${extractDay(a.date)} | ${status}\n`;
        });
        message += `\n`;
    });
    
    // Summary
    const total = accounts.length;
    const expired = accounts.filter(a => getDaysUntilExpiry(a.date) < 0).length;
    const today = accounts.filter(a => getDaysUntilExpiry(a.date) === 0).length;
    const upcoming = accounts.filter(a => getDaysUntilExpiry(a.date) > 0).length;
    
    message += `━${'━'.repeat(20)}━\n`;
    message += `<b>📊 Summary</b>\n`;
    message += `   🔴 Expired: ${expired}\n`;
    message += `   🟡 Today: ${today}\n`;
    message += `   🟠 Upcoming: ${upcoming}\n`;
    message += `   📧 Total: ${total}\n`;
    message += `━${'━'.repeat(20)}━\n`;
    message += `\n💡 Manage accounts: ${process.env.APP_URL || 'https://your-app.web.app'}`;
    
    await sendTelegramMessage(message);
}

// ============================================
// WEB PUSH - phone notifications
// ============================================

// Send a push to every phone that enabled it in the app, once per day
async function sendPushToPhones(expired, today, upcoming, todayKey) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn('⚠️ VAPID keys not set, skipping phone push');
        return;
    }

    try {
        const pushed = await db.collection('pushLog').doc('daily').get();
        if (pushed.exists && pushed.data().lastKey === todayKey) {
            console.log('📲 Phone push already sent today, skipping');
            return;
        }
    } catch (e) {
        console.warn('⚠️ Could not read push log:', e.message);
    }

    // Read every stored push subscription
    const subs = [];
    try {
        const snap = await db.collection('pushSubscriptions').get();
        snap.forEach(doc => subs.push({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('❌ Could not read push subscriptions:', e.message);
        return;
    }
    if (subs.length === 0) {
        console.log('📲 No phones have push enabled yet');
        return;
    }

    const total = expired.length + today.length + upcoming.length;
    const payload = {
        title: `📧 ${total} email account(s) need attention`,
        body: `🔴 ${expired.length} expired · 🟡 ${today.length} today · 🟠 ${upcoming.length} expiring`,
        url: process.env.APP_URL || ''
    };
    const message = JSON.stringify(payload);

    let sent = 0;
    for (const sub of subs) {
        const subData = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: (sub.keys && sub.keys.p256dh) || sub.p256dh || '',
                auth: (sub.keys && sub.keys.auth) || sub.auth || ''
            }
        };
        try {
            await webpush.sendNotification(subData, message);
            sent++;
            console.log(`📲 Push sent to ${sub.device || sub.id}`);
        } catch (error) {
            console.error(`📲 Push failed for ${sub.device || sub.id}: ${error.message}`);
            // 404/410 = subscription gone, clean it up
            if (error.statusCode === 404 || error.statusCode === 410) {
                try { await db.collection('pushSubscriptions').doc(sub.id).delete(); } catch (e) { /* ignore */ }
            }
        }
    }

    // Mark today as done so the 10:46/11:46 reruns don't duplicate
    try {
        await db.collection('pushLog').doc('daily').set({
            lastKey: todayKey,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('⚠️ Could not mark push sent:', e.message);
    }
    console.log(`📲 Phone pushes sent: ${sent}/${subs.length}`);
}

// ============================================
// MAIN CHECK FUNCTION - 9:46 AM Algeria time
// ============================================
async function checkAndNotify() {
    const startTime = Date.now();
    const now = getAlgeriaDate();
    const currentTime = getCurrentTimeAlgeria();
    
    console.log(`━${'━'.repeat(50)}━`);
    console.log(`📧 Email Expiry Check Started`);
    console.log(`📅 ${now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' })}`);
    console.log(`⏰ ${currentTime.hour}:${String(currentTime.minute).padStart(2, '0')}:${String(currentTime.second).padStart(2, '0')} (Algeria)`);
    console.log(`⚙️  Settings:`);
    console.log(`   - Days before: ${NOTIFY_DAYS_BEFORE}`);
    console.log(`   - Notify expired: ${NOTIFY_EXPIRED}`);
    console.log(`   - Notify today: ${NOTIFY_TODAY}`);
    console.log(`   - Scheduled time: ${NOTIFY_HOUR}:${String(NOTIFY_MINUTE).padStart(2, '0')} Algeria time`);
    console.log(`━${'━'.repeat(50)}━`);
    
    // Removed time check: Let cron job handle scheduling
        console.log(`⏰ Running expiry check at ${currentTime.hour}:${String(currentTime.minute).padStart(2, '0')} Algeria time`);
    
    const todayKey = getTodayKey();
    console.log(`📅 Today's key: ${todayKey}`);
    
    // Fetch accounts
    let snapshot;
    try {
        snapshot = await db.collection('accounts').get();
    } catch (error) {
        console.error('❌ Failed to read Firestore:', error.message);
        await admin.app().delete();
        process.exit(1);
    }
    
    const accounts = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        accounts.push({
            id: doc.id,
            client: data.client || 'Uncategorized',
            email: data.email || '',
            date: data.date || '',
            replacementEmail: data.replacementEmail || '',
            hasProblem: data.hasProblem || false,
            problemNote: data.problemNote || ''
        });
    });
    
    console.log(`📊 Found ${accounts.length} total accounts`);
    
    if (accounts.length === 0) {
        console.log('⚠️ No accounts found');
        await admin.app().delete();
        return;
    }
    
    // Filter accounts
    const expired = [];
    const today = [];
    const upcoming = [];
    let alreadyNotifiedCount = 0;
    let noDateCount = 0;
    
    for (const account of accounts) {
        if (!account.date) {
            noDateCount++;
            continue;
        }
        const days = getDaysUntilExpiry(account.date);
        if (days === null) {
            noDateCount++;
            continue;
        }
        
        const alreadyNotified = await wasNotifiedToday(account.id, todayKey);
        if (alreadyNotified) {
            alreadyNotifiedCount++;
            continue;
        }
        
        if (days < 0) {
            expired.push(account);
        } else if (days === 0) {
            today.push(account);
        } else if (days > 0 && days <= NOTIFY_DAYS_BEFORE) {
            upcoming.push(account);
        }
    }
    
    console.log(`📊 Notification breakdown:`);
    console.log(`   🔴 Expired: ${expired.length}`);
    console.log(`   🟡 Today: ${today.length}`);
    console.log(`   🟠 Upcoming (${NOTIFY_DAYS_BEFORE}d): ${upcoming.length}`);
    console.log(`   ⏭️ Already notified: ${alreadyNotifiedCount}`);
    console.log(`   ⚠️ No date: ${noDateCount}`);
    
    let sentCount = 0;
    
    // Send notifications at 9:46 AM
    if (NOTIFY_EXPIRED && expired.length > 0) {
        console.log(`📤 Sending expired notification (${expired.length} accounts)...`);
        await sendNotificationMessage(expired, 'expired');
        for (const a of expired) {
            await markNotified(a.id, todayKey);
            sentCount++;
        }
        console.log(`✅ Sent ${expired.length} expired notifications`);
    }
    
    if (NOTIFY_TODAY && today.length > 0) {
        console.log(`📤 Sending today notification (${today.length} accounts)...`);
        await sendNotificationMessage(today, 'today');
        for (const a of today) {
            await markNotified(a.id, todayKey);
            sentCount++;
        }
        console.log(`✅ Sent ${today.length} today notifications`);
    }
    
    if (upcoming.length > 0) {
        console.log(`📤 Sending upcoming notification (${upcoming.length} accounts)...`);
        await sendNotificationMessage(upcoming, 'upcoming');
        for (const a of upcoming) {
            await markNotified(a.id, todayKey);
            sentCount++;
        }
        console.log(`✅ Sent ${upcoming.length} upcoming notifications`);
    }
    
    // Send the phone push (deduplicated per day) whenever something needed attention
    if (sentCount > 0) {
        await sendPushToPhones(expired, today, upcoming, todayKey);
    }
    
    // Send "all clear" message if no notifications sent
    if (sentCount === 0) {
        const totalExpiring = expired.length + today.length + upcoming.length;
        if (totalExpiring === 0) {
            console.log('📤 No accounts expiring. Sending all-clear message...');
            await sendTelegramMessage(
                `📧 <b>All Clear!</b>\n` +
                `📅 ${now.toLocaleDateString('en-US', { timeZone: 'Africa/Algiers' })}\n` +
                `⏰ 9:46 AM Algeria time\n` +
                `━${'━'.repeat(20)}━\n` +
                `✅ No accounts are expiring within ${NOTIFY_DAYS_BEFORE} days.\n` +
                `📊 Total accounts: ${accounts.length}\n` +
                `💡 Everything is up to date! 👍`
            );
        }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`━${'━'.repeat(50)}━`);
    console.log(`✅ Check completed in ${elapsed}s`);
    console.log(`📤 Total notifications sent: ${sentCount}`);
    console.log(`━${'━'.repeat(50)}━`);
    
    await admin.app().delete();
}

// ============================================
// HANDLE ERRORS
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// ============================================
// RUN THE CHECK
// ============================================
checkAndNotify().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});