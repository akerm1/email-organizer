// ============================================
// SETTINGS PAGE & CONFIGURATION MODALS
// ============================================

// Build the whole Settings content area from the sidebar tabs
function renderSettings() {
    const content = document.getElementById('settingsContent');
    if (!content) return;

    content.innerHTML = `
        <div class="settings-panel" id="settings-panel-general">
            <h3>EmailVault Pro</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
                Manage your email accounts and get notified before they expire.
            </p>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Version</label>
                    <p id="settingsVersion">${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</p>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-info">
                    <label>App Update</label>
                    <p id="updateStatusText">Up to date</p>
                </div>
            </div>
            <div class="settings-actions" style="margin-top: 0;">
                <button class="btn btn-secondary btn-sm" id="checkForUpdatesBtn">
                    <i class="fas fa-search"></i> Check for Updates
                </button>
                <button class="btn btn-primary btn-sm" id="applyUpdateBtn" disabled>
                    <i class="fas fa-sync-alt"></i> Update Now
                </button>
            </div>
            <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
                The app updates itself in place — your data stays, no reinstall needed.
            </p>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Accounts under management</label>
                    <p><strong id="settingsTotalAccounts">0</strong> accounts, <strong id="settingsTotalClients">0</strong> clients</p>
                </div>
            </div>
        </div>

        <div class="settings-panel" id="settings-panel-notifications" style="display:none;">
            <h3>Notifications</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
                Daily digest at 9:46 AM Algeria time (UTC+1) for expiring or expired accounts.
            </p>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Current Status</label>
                    <p id="notifStatusText"></p>
                </div>
                <button class="btn btn-primary" id="openNotifSettings">
                    <i class="fas fa-bell"></i> Configure
                </button>
            </div>
        </div>

        <div class="settings-panel" id="settings-panel-phone" style="display:none;">
            <h3>Phone Notifications</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
                Get the daily 9:46 AM Algeria alert as a real system notification on this
                phone, even when the app is closed.
            </p>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Status</label>
                    <p id="pushStatusText">Checking…</p>
                </div>
            </div>
            <div class="settings-actions" style="margin-top: 0;">
                <button class="btn btn-primary btn-sm" id="enablePushBtn" style="display:none;">
                    <i class="fas fa-bell"></i> Enable phone notifications
                </button>
                <button class="btn btn-secondary btn-sm" id="disablePushBtn" style="display:none;">
                    <i class="fas fa-bell-slash"></i> Disable
                </button>
            </div>
        </div>

        <div class="settings-panel" id="settings-panel-telegram" style="display:none;">
            <h3>Telegram</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
                Receive the same daily digest straight to your phone via a Telegram bot.
            </p>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Current Status</label>
                    <p id="telegramStatusText"></p>
                </div>
                <button class="btn btn-primary" id="openTelegramSettings">
                    <i class="fab fa-telegram"></i> Configure
                </button>
            </div>
        </div>

        <div class="settings-panel" id="settings-panel-appearance" style="display:none;">
            <h3>Appearance</h3>
            <div class="setting-item">
                <div class="setting-info">
                    <label>Dark Mode</label>
                    <p>Switch between light and dark theme</p>
                </div>
                <button class="btn btn-secondary" id="themeBtnSettings">
                    <i class="fas fa-moon"></i> Toggle Dark Mode
                </button>
            </div>
        </div>

        <div class="settings-panel" id="settings-panel-backup" style="display:none;">
            <h3>Backup &amp; Restore</h3>
            <p style="color: var(--text-secondary); margin-top: 8px;">
                Export all of your accounts to a file. CSV opens in Excel, JSON is the
                most complete backup.
            </p>
            <div class="settings-actions">
                <button class="btn btn-secondary" id="backupCsv">
                    <i class="fas fa-file-csv"></i> Export CSV
                </button>
                <button class="btn btn-secondary" id="backupExcel">
                    <i class="fas fa-file-excel"></i> Export Excel
                </button>
                <button class="btn btn-secondary" id="backupJson">
                    <i class="fas fa-file-code"></i> Export JSON
                </button>
            </div>
        </div>
    `;

    bindSettings();
}

// Bind the Settings sidebar tabs and rendered action buttons
function bindSettings() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const name = tab.dataset.tab;
            document.querySelectorAll('.settings-panel').forEach(p => {
                p.style.display = p.id === `settings-panel-${name}` ? '' : 'none';
            });
        });
    });

    document.getElementById('openNotifSettings').addEventListener('click', openNotificationSettings);
    document.getElementById('openTelegramSettings').addEventListener('click', openTelegramSettings);
    document.getElementById('themeBtnSettings').addEventListener('click', () => {
        toggleTheme();
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.getElementById('themeBtnSettings').innerHTML =
            `<i class="fas fa-${dark ? 'sun' : 'moon'}"></i> Toggle Dark Mode`;
    });
    document.getElementById('backupCsv').addEventListener('click', () => exportToCSV());
    document.getElementById('backupExcel').addEventListener('click', () => exportToExcel());
    document.getElementById('backupJson').addEventListener('click', () => exportToJSON());

    const checkBtn = document.getElementById('checkForUpdatesBtn');
    if (checkBtn) checkBtn.addEventListener('click', () => {
        checkBtn.disabled = true;
        const label = checkBtn.innerHTML;
        checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
        checkForUpdates().finally(() => {
            checkBtn.disabled = false;
            checkBtn.innerHTML = label;
        });
    });
    const applyBtn = document.getElementById('applyUpdateBtn');
    if (applyBtn) applyBtn.addEventListener('click', applyUpdate);
    if (typeof updateUpdateView === 'function') updateUpdateView();

    const enablePush = document.getElementById('enablePushBtn');
    if (enablePush) enablePush.addEventListener('click', requestPushPermission);
    const disablePush = document.getElementById('disablePushBtn');
    if (disablePush) disablePush.addEventListener('click', disablePushNotifications);
    if (typeof updatePushView === 'function') updatePushView();

    updateSettingsStatus();
}

// Live status labels on the Settings page
function updateSettingsStatus() {
    const notifText = document.getElementById('notifStatusText');
    const telegramText = document.getElementById('telegramStatusText');
    const total = document.getElementById('settingsTotalAccounts');
    const clientCount = document.getElementById('settingsTotalClients');
    if (notifText) {
        const s = getNotificationSettings();
        const modeLabel = s.mode === 'expired' ? 'Expired only' :
                          s.mode === 'today' ? 'Today & Expired' : `Within ${s.daysBefore} days`;
        notifText.textContent = `${s.enabled ? 'Enabled' : 'Disabled'} · ${modeLabel} · ${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')} Algeria`;
    }
    if (telegramText) {
        const s = getNotificationSettings();
        telegramText.textContent = s.telegramEnabled && s.telegramToken && s.telegramChatId
            ? 'Connected'
            : 'Not configured';
    }
    if (total) total.textContent = window.accounts.length;
    if (clientCount) clientCount.textContent = window.clients.length;
}

// Notification settings modal
function openNotificationSettings() {
    const s = getNotificationSettings();
    document.getElementById('notifEnabled').checked = s.enabled;
    document.getElementById('notifMode').value = s.mode;
    document.getElementById('notifDaysBefore').value = s.daysBefore;
    document.getElementById('notifHour').value = s.hour;
    document.getElementById('notifMinute').value = s.minute;
    updateDaysBeforeVisibility();
    document.getElementById('notificationModal').classList.add('active');
}

function closeNotificationSettings() {
    document.getElementById('notificationModal').classList.remove('active');
}

function updateDaysBeforeVisibility() {
    const mode = document.getElementById('notifMode').value;
    document.getElementById('daysBeforeGroup').style.display = mode === 'upcoming' ? '' : 'none';
}

function saveNotificationSettingsModal() {
    const mode = document.getElementById('notifMode').value;
    let hour = parseInt(document.getElementById('notifHour').value, 10);
    let minute = parseInt(document.getElementById('notifMinute').value, 10);
    const days = parseInt(document.getElementById('notifDaysBefore').value, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) hour = 9;
    if (isNaN(minute) || minute < 0 || minute > 59) minute = 46;

    const settings = {
        ...getNotificationSettings(),
        enabled: document.getElementById('notifEnabled').checked,
        mode,
        daysBefore: isNaN(days) || days < 1 ? 7 : days,
        hour,
        minute
    };
    saveNotificationSettings(settings);

    const range = document.getElementById('expiryRange');
    if (range && [...range.options].some(o => Number(o.value) === settings.daysBefore)) {
        range.value = String(settings.daysBefore);
    }
    closeNotificationSettings();
    updateSettingsStatus();
    showToast('Notification settings saved', 'success');
}

// Telegram settings modal
function openTelegramSettings() {
    const s = getNotificationSettings();
    document.getElementById('telegramEnabled').checked = !!s.telegramEnabled;
    document.getElementById('telegramToken').value = s.telegramToken || '';
    document.getElementById('telegramChatId').value = s.telegramChatId || '';
    document.getElementById('telegramModal').classList.add('active');
}

function closeTelegramSettings() {
    document.getElementById('telegramModal').classList.remove('active');
}

function saveTelegramSettings() {
    const settings = {
        ...getNotificationSettings(),
        telegramEnabled: document.getElementById('telegramEnabled').checked,
        telegramToken: document.getElementById('telegramToken').value.trim(),
        telegramChatId: document.getElementById('telegramChatId').value.trim()
    };
    saveNotificationSettings(settings);
    closeTelegramSettings();
    updateSettingsStatus();
    showToast('Telegram settings saved', 'success');
}

// Wire everything on load
document.addEventListener('DOMContentLoaded', () => {
    renderSettings();

    // Topbar bell opens notification settings
    document.getElementById('notifBell').addEventListener('click', openNotificationSettings);

    // Notification modal
    document.getElementById('notifSave').addEventListener('click', saveNotificationSettingsModal);
    document.getElementById('notifCancel').addEventListener('click', closeNotificationSettings);
    document.getElementById('notifMode').addEventListener('change', updateDaysBeforeVisibility);

    // Telegram modal
    document.getElementById('telegramSave').addEventListener('click', saveTelegramSettings);
    document.getElementById('telegramCancel').addEventListener('click', closeTelegramSettings);
    document.getElementById('testTelegram').addEventListener('click', () => {
        testTelegramConnection(
            document.getElementById('telegramToken').value.trim(),
            document.getElementById('telegramChatId').value.trim()
        );
    });

    // Reflect saved notification window on the Expiring page
    const settings = getNotificationSettings();
    const range = document.getElementById('expiryRange');
    if (range && [...range.options].some(o => Number(o.value) === settings.daysBefore)) {
        range.value = String(settings.daysBefore);
    }
});

// Export
window.renderSettings = renderSettings;
window.openNotificationSettings = openNotificationSettings;
window.openTelegramSettings = openTelegramSettings;