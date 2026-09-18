// ============================================
// UTILITY FUNCTIONS
// ============================================

// Date Utilities
function extractDay(dateValue) {
    if (!dateValue) return null;
    const num = parseInt(dateValue, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) return num;
    return null;
}

function formatDateDisplay(dateValue) {
    const day = extractDay(dateValue);
    if (day === null) return '—';
    return `Day ${day}`;
}

function getDaysUntilExpiry(dateValue) {
    const day = extractDay(dateValue);
    if (day === null) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check this month
    const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(day, lastDayThisMonth);
    const thisMonthDate = new Date(today.getFullYear(), today.getMonth(), clampedDay);
    
    if (thisMonthDate >= today) {
        return Math.round((thisMonthDate - today) / (1000 * 60 * 60 * 24));
    }
    
    // Check next month
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
    const clampedDayNext = Math.min(day, lastDayNextMonth);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, clampedDayNext);
    return Math.round((nextMonth - today) / (1000 * 60 * 60 * 24));
}

function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getAlgeriaTime() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3600000); // UTC+1
}

// String Utilities
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function truncate(text, length = 50) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

// Validation
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateDay(day) {
    const num = parseInt(day, 10);
    return !isNaN(num) && num >= 1 && num <= 31;
}

// Copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied to clipboard', 'success'))
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-999999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Copied to clipboard', 'success');
    } catch (err) {
        showToast('Copy not supported', 'error');
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.info}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Format relative time
function timeAgo(date) {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, value] of Object.entries(intervals)) {
        const count = Math.floor(seconds / value);
        if (count > 0) {
            return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
        }
    }
    return 'Just now';
}

// Generate random ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Export
window.extractDay = extractDay;
window.formatDateDisplay = formatDateDisplay;
window.getDaysUntilExpiry = getDaysUntilExpiry;
window.getTodayKey = getTodayKey;
window.getAlgeriaTime = getAlgeriaTime;
window.escapeHtml = escapeHtml;
window.truncate = truncate;
window.validateEmail = validateEmail;
window.validateDay = validateDay;
window.copyToClipboard = copyToClipboard;
window.showToast = showToast;
window.debounce = debounce;
window.timeAgo = timeAgo;
window.generateId = generateId;