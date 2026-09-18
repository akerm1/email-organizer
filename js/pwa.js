/* ============================================
   PWA - Service Worker & App Install
   ============================================ */

const INSTALL_DISMISS_KEY = 'emailvaultInstallDismissed';

let deferredPrompt = null;
let installBannerShown = false;

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

// Service worker registration
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (navigator.serviceWorker.controller) return;

  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[PWA] Service worker registered');
  } catch (error) {
    console.warn('[PWA] Service worker registration failed:', error);
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

  // Hide install UI when already installed
  if (isStandalone()) {
    if (installBtn) installBtn.style.display = 'none';
    hideInstallBanner();
  }
}

document.addEventListener('DOMContentLoaded', initPWA);