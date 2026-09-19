// ============================================
// NOTIFICATION SYSTEM
// ============================================

const NOTIFICATION_KEY = 'emailVaultNotifications';

// Default settings - 9:46 AM Algeria time
const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'upcoming',
    daysBefore: 7,
    hour: 9,              // 9 AM
    minute: 46,           // 46 minutes
    telegramEnabled: false,
    telegramToken: '',
    telegramChatId: ''
};

// Get notification settings
function getNotificationSettings() {
    try {
        const saved = localStorage.getItem(NOTIFICATION_KEY);
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

// Save notification settings
function saveNotificationSettings(settings) {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(settings));
}

// Accounts within N days of expiring (includes already-expired accounts)
function getAccountsWithin(days) {
    const results = [];
    window.accounts.forEach(account => {
        if (!account.date) return;
        const d = getDaysUntilExpiry(account.date);
        if (d === null) return;
        if (d <= days) {
            results.push({
                ...account,
                daysUntilExpiry: d,
                status: d < 0 ? 'expired' : d === 0 ? 'today' : 'upcoming'
            });
        }
    });
    return results;
}

// Get expiring accounts based on settings
function getExpiringAccounts(settings = null) {
    if (!settings) settings = getNotificationSettings();
    const results = [];
    
    window.accounts.forEach(account => {
        if (!account.date) return;
        const days = getDaysUntilExpiry(account.date);
        if (days === null) return;
        
        let shouldNotify = false;
        let status = '';
        
        if (settings.mode === 'expired' && days < 0) {
            shouldNotify = true;
            status = 'expired';
        } else if (settings.mode === 'today' && (days < 0 || days === 0)) {
            shouldNotify = true;
            status = days < 0 ? 'expired' : 'today';
        } else if (settings.mode === 'upcoming' && days >= 0 && days <= settings.daysBefore) {
            shouldNotify = true;
            status = days === 0 ? 'today' : 'upcoming';
        }
        
        if (shouldNotify) {
            results.push({ ...account, daysUntilExpiry: days, status });
        }
    });
    
    return results;
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    
    const result = await Notification.requestPermission();
    return result === 'granted';
}

// Send browser notification
function sendBrowserNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    
    try {
        const notif = new Notification(title, {
            body: body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📧</text></svg>',
            tag: 'email-expiry-' + Date.now(),
            requireInteraction: true
        });
        
        notif.onclick = () => {
            window.focus();
            notif.close();
        };
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

// Send Telegram message
async function sendTelegramMessage(message) {
    const settings = getNotificationSettings();
    if (!settings.telegramEnabled || !settings.telegramToken || !settings.telegramChatId) {
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: settings.telegramChatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        return response.ok;
    } catch (e) {
        console.warn('Telegram send failed:', e);
        return false;
    }
}

// Check and send notifications
async function checkAndNotify(force = false) {
    const settings = getNotificationSettings();
    if (!settings.enabled && !force) return;
    
    const expiring = getExpiringAccounts(settings);
    if (expiring.length === 0) return;
    
    // Group by status
    const grouped = {
        expired: expiring.filter(a => a.status === 'expired'),
        today: expiring.filter(a => a.status === 'today'),
        upcoming: expiring.filter(a => a.status === 'upcoming')
    };
    
    // Build notification message
    let message = `📧 <b>Email Account Status</b>\n`;
    message += `📅 ${new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Algiers', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    message += `⏰ 9:46 AM Algeria time\n`;
    message += `━${'━'.repeat(20)}━\n\n`;
    
    if (grouped.expired.length > 0) {
        message += `<b>🔴 Expired (${grouped.expired.length})</b>\n`;
        grouped.expired.forEach(a => {
            message += `  • ${a.email} (${a.client})\n`;
        });
        message += `\n`;
    }
    
    if (grouped.today.length > 0) {
        message += `<b>🟡 Expires Today (${grouped.today.length})</b>\n`;
        grouped.today.forEach(a => {
            message += `  • ${a.email} (${a.client})\n`;
        });
        message += `\n`;
    }
    
    if (grouped.upcoming.length > 0) {
        message += `<b>🟠 Expiring Soon (${grouped.upcoming.length})</b>\n`;
        grouped.upcoming.forEach(a => {
            message += `  • ${a.email} (${a.client}) - ${a.daysUntilExpiry}d left\n`;
        });
        message += `\n`;
    }
    
    message += `━${'━'.repeat(20)}━\n`;
    message += `📊 <b>Total: ${expiring.length} accounts need attention</b>\n`;
    message += `💡 Manage: ${window.location.origin}`;
    
    // Send notifications
    if (settings.telegramEnabled) {
        await sendTelegramMessage(message);
    }
    
    // Send browser notification
    const title = `${expiring.length} account${expiring.length > 1 ? 's' : ''} expiring soon`;
    const body = `${grouped.expired.length} expired, ${grouped.today.length} today, ${grouped.upcoming.length} upcoming`;
    sendBrowserNotification(title, body);
    
    return expiring;
}

// Test Telegram connection
async function testTelegramConnection(token, chatId) {
    if (!token || !chatId) {
        showToast('Please enter both Bot Token and Chat ID', 'error');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: '🔔 <b>EmailVault Pro</b>\n✅ Connection successful!\n⏰ Notifications will be sent at 9:46 AM Algeria time.',
                parse_mode: 'HTML'
            })
        });
        
        if (response.ok) {
            showToast('Telegram connected successfully!', 'success');
            return true;
        } else {
            const error = await response.json();
            showToast(`Telegram error: ${error.description || 'Unknown'}`, 'error');
            return false;
        }
    } catch (e) {
        showToast('Failed to connect to Telegram', 'error');
        return false;
    }
}

// Export
window.getNotificationSettings = getNotificationSettings;
window.saveNotificationSettings = saveNotificationSettings;
window.getExpiringAccounts = getExpiringAccounts;
window.getAccountsWithin = getAccountsWithin;
window.checkAndNotify = checkAndNotify;
window.testTelegramConnection = testTelegramConnection;
window.sendBrowserNotification = sendBrowserNotification;
window.sendTelegramMessage = sendTelegramMessage;