/* ============================================
   PWA - Service Worker & App Install
   ============================================ */

const INSTALL_DISMISS_KEY = 'emailvaultInstallDismissed';
const UPDATE_DISMISS_KEY = 'emailvaultUpdateDismissed';
const PUSH_ENABLED_KEY = 'emailvaultPushEnabled';
const PUSH_DEVICE_KEY = 'emailvaultDeviceId';
const VAPID_PUBLIC_KEY = 'BM5yqyfxkssiy_RJfIMINi3ua8AH_HQEMwfuV2ahqOa5Yqo7ry89SpEGnL1MyZCqqMbaEo9lzenG12HJtCQjxpM';

let deferredPrompt = null;
let installBannerShown = false;

// ---- In-app self-update state ----
let updateRegistration = null;    // active ServiceWorkerRegistration
let updateWorker = null;          // newest installing/waiting service worker
let hadControllerBefore = false;  // was a SW already controlling before we started?
let refreshing = false;           // guards against reload loops

// ---- Phone push notifications (Web Push) ----

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getDeviceId() {
  let id = localStorage.getItem(PUSH_DEVICE_KEY);
  if (!id) {
    id = 'device-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem(PUSH_DEVICE_KEY, id);
  }
  return id;
}

async function pushSupported() {
  return !!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && navigator.onLine);
}

async function getCurrentPushSubscription() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return null;
    return reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

async function savePushSubscription(sub) {
  const deviceId = getDeviceId();
  await getDB().collection('pushSubscriptions').doc(deviceId).set({
    device: deviceId,
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.getKey('p256dh') ? arrayBufferToBase64(sub.getKey('p256dh')) : '',
      auth: sub.getKey('auth') ? arrayBufferToBase64(sub.getKey('auth')) : ''
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function requestPushPermission() {
  if (!(await pushSupported())) {
    showToast('Push notifications not supported in this browser', 'error');
    return false;
  }

  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    showToast('Notification permission blocked. Allow notifications in your browser/app settings.', 'error');
    updatePushView();
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY
      });
    }
    await savePushSubscription(sub);
    localStorage.setItem(PUSH_ENABLED_KEY, '1');
    showToast('Phone notifications enabled', 'success');
    updatePushView();
    return true;
  } catch (error) {
    console.warn('[PWA] Push subscribe failed:', error);
    showToast('Could not enable phone notifications', 'error');
    updatePushView();
    return false;
  }
}

async function disablePushNotifications() {
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) await sub.unsubscribe();
    const db = getDB();
    try { await db.collection('pushSubscriptions').doc(getDeviceId()).delete(); } catch (e) { /* already gone */ }
    localStorage.removeItem(PUSH_ENABLED_KEY);
    showToast('Phone notifications disabled', 'info');
  } catch (error) {
    console.warn('[PWA] Push unsubscribe failed:', error);
    showToast('Failed to disable notifications', 'error');
  }
  updatePushView();
}

async function updatePushView() {
  const statusEl = document.getElementById('pushStatusText');
  const enableBtn = document.getElementById('enablePushBtn');
  const disableBtn = document.getElementById('disablePushBtn');

  const supported = await pushSupported();
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const enabled = localStorage.getItem(PUSH_ENABLED_KEY) === '1';
  const sub = enabled ? await getCurrentPushSubscription() : null;

  if (statusEl) {
    if (!supported) statusEl.textContent = 'Not supported on this browser or app';
    else if (perm === 'denied') statusEl.textContent = 'Blocked — please allow notifications in your browser settings';
    else if (sub) statusEl.textContent = 'Enabled — this phone will be notified at 9:46 AM Algeria time';
    else if (enabled) statusEl.textContent = 'Enabled, awaiting subscription — re-open the app once';
    else statusEl.textContent = 'Disabled — notifications only show while the app is open';
  }
  if (enableBtn) enableBtn.style.display = supported ? '' : 'none';
  if (disableBtn) disableBtn.style.display = supported && (enabled || perm === 'granted') ? '' : 'none';
}

// Detect when running as an installed app
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// Detect iOS Safari (no beforeinstallprompt support)
function isIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua);
}

// Show/hide the install banner
function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  if (isStandalone() || localStorage.getItem(INSTALL_DISMISS_KEY)) return;
  banner.classList.add('visible');
  installBannerShown = true;
}

function hideInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.remove('visible');
  installBannerShown = false;
}

function dismissInstallBanner() {
  hideInstallBanner();
  localStorage.setItem(INSTALL_DISMISS_KEY, '1');
}

// UI for iOS: shows "Add to Home Screen" instructions
function openInstallHelp() {
  if (isStandalone()) return;
  document.getElementById('installHelpModal').classList.add('active');
}

// Main install action
async function handleInstallClick() {
  if (deferredPrompt) {
    // Android / Desktop Chrome: native prompt
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice && choice.outcome === 'accepted') {
      showToast('Installing EmailVault Pro...', 'success');
    }
    deferredPrompt = null;
    hideInstallBanner();
    return;
  }
  openInstallHelp();
}

// Service worker registration (re-registers so updates are picked up)
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    hadControllerBefore = !!navigator.serviceWorker.controller;
    updateRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

    // A new service worker (new version) has been downloaded
    updateRegistration.addEventListener('updatefound', () => {
      updateWorker = updateRegistration.installing || updateRegistration.waiting;
      if (!updateWorker) return;

      if (updateWorker.state === 'installed') {
        onUpdateReady();
        return;
      }
      updateWorker.addEventListener('statechange', () => {
        if (updateWorker.state === 'installed') onUpdateReady();
        updateUpdateView();
      });
    });

    // Reflect a worker that was already waiting from a previous check
    if (!updateWorker && updateRegistration.waiting) {
      updateWorker = updateRegistration.waiting;
      updateUpdateView();
    }

    // New worker takes control -> reload so the fresh assets are used
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerBefore) { hadControllerBefore = true; return; }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Quietly check for updates periodically + when the app regains focus
    setInterval(() => {
      if (navigator.onLine && updateRegistration) updateRegistration.update();
    }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine && updateRegistration) updateRegistration.update();
    });

    console.log('[PWA] Service worker registered');
  } catch (error) {
    console.warn('[PWA] Service worker registration failed:', error);
  }
}

// A new version finished installing; prompt the user to apply it
function onUpdateReady() {
  updateUpdateView();
  showUpdateBanner();
}

// Reflect update state in the Settings "App Update" row
function updateUpdateView() {
  const available = !!updateWorker;

  const statusEl = document.getElementById('updateStatusText');
  if (statusEl) {
    const ver = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '';
    statusEl.innerHTML = available
      ? `New version ready <strong>${ver}</strong>`
      : 'Up to date';
  }

  const applyBtn = document.getElementById('applyUpdateBtn');
  if (applyBtn) applyBtn.disabled = !available;
}

// Show the in-app "new version" banner
function showUpdateBanner() {
  if (isStandalone()) hideInstallBanner();
  if (localStorage.getItem(UPDATE_DISMISS_KEY)) return;
  const banner = document.getElementById('updateBanner');
  if (banner) banner.classList.add('visible');
}

function hideUpdateBanner() {
  const banner = document.getElementById('updateBanner');
  if (banner) banner.classList.remove('visible');
}

function dismissUpdateBanner() {
  hideUpdateBanner();
  localStorage.setItem(UPDATE_DISMISS_KEY, '1');
}

// Download & apply the new version (keeps the installed app; no reinstall needed)
function applyUpdate() {
  if (updateWorker && updateWorker.state === 'installed') {
    showToast('Downloading new version...', 'info');
    hideUpdateBanner();
    updateWorker.postMessage({ type: 'SKIP_WAITING' });
    // controllerchange then reloads the page with fresh assets automatically
  }
}

// Manually ask the service worker if a new version exists
async function checkForUpdates() {
  if (!updateRegistration) return false;

  const statusEl = document.getElementById('updateStatusText');
  if (statusEl) statusEl.textContent = 'Checking...';
  try {
    await updateRegistration.update();
    if (statusEl) updateUpdateView();
    return !!updateWorker;
  } catch (error) {
    console.warn('[PWA] Update check failed:', error);
    if (statusEl) statusEl.textContent = 'Update check failed';
    return false;
  }
}

function initPWA() {
  registerServiceWorker();

  // Listen for the install prompt (Android/Chrome/Edge)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallBanner();
  });

  // Installed successfully
  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    showToast('EmailVault Pro installed to your device!', 'success');
  });

  // Show an install banner for iOS users (no native prompt)
  if (isIOS() && !isStandalone()) {
    setTimeout(showInstallBanner, 3000);
  }

  // Wire up buttons
  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.addEventListener('click', handleInstallClick);

  const bannerInstall = document.getElementById('installBtnConfirm');
  if (bannerInstall) bannerInstall.addEventListener('click', handleInstallClick);

  const bannerDismiss = document.getElementById('installBtnDismiss');
  if (bannerDismiss) bannerDismiss.addEventListener('click', dismissInstallBanner);

  const helpCancel = document.getElementById('installHelpCancel');
  if (helpCancel) helpCancel.addEventListener('click', () => {
    document.getElementById('installHelpModal').classList.remove('active');
  });

  const helpOk = document.getElementById('installHelpOk');
  if (helpOk) helpOk.addEventListener('click', () => {
    document.getElementById('installHelpModal').classList.remove('active');
  });

  // In-app update banner
  const updateConfirm = document.getElementById('updateBtnConfirm');
  if (updateConfirm) updateConfirm.addEventListener('click', applyUpdate);

  const updateDismiss = document.getElementById('updateBtnDismiss');
  if (updateDismiss) updateDismiss.addEventListener('click', dismissUpdateBanner);

  // Hide install UI when already installed
  if (isStandalone()) {
    if (installBtn) installBtn.style.display = 'none';
    hideInstallBanner();
  }

  updateUpdateView();
  updatePushView();
}

// Export update helpers for the Settings page
window.checkForUpdates = checkForUpdates;
window.applyUpdate = applyUpdate;
window.updateUpdateView = updateUpdateView;

// Export push helpers for the Settings page
window.requestPushPermission = requestPushPermission;
window.disablePushNotifications = disablePushNotifications;
window.updatePushView = updatePushView;

document.addEventListener('DOMContentLoaded', initPWA);