// ============================================
// MAIN APPLICATION
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize Firebase
        await initFirebase();
        await loadAccounts();
        
        // Hide loading screen
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('app').style.display = 'block';
        
        // Initialize UI
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        initCharts();
        updateBulkBar();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check notifications
        setTimeout(() => {
            if (getNotificationSettings().enabled) {
                requestNotificationPermission();
            }
        }, 2000);
        
        showToast('Welcome to EmailVault Pro!', 'success');
        
    } catch (error) {
        console.error('App initialization failed:', error);
        document.getElementById('loadingScreen').innerHTML = `
            <div class="loading-content" style="color: var(--danger);">
                <i class="fas fa-exclamation-circle" style="font-size: 48px;"></i>
                <h2>Failed to Load</h2>
                <p>${escapeHtml(error.message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
});

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateTo(page);
        });
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Sidebar toggle (mobile)
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        const open = sidebar.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('show', open);
    });
    
    // Sidebar backdrop closes the drawer
    document.getElementById('sidebarBackdrop').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarBackdrop').classList.remove('show');
    });
    
    // Quick add button
    document.getElementById('quickAddBtn').addEventListener('click', openAddAccountModal);
    document.getElementById('addAccountBtn').addEventListener('click', openAddAccountModal);
    document.getElementById('fabAddBtn').addEventListener('click', openAddAccountModal);
    
    // Account form
    document.getElementById('modalSave').addEventListener('click', saveAccountForm);
    document.getElementById('modalCancel').addEventListener('click', closeAccountModal);
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    // Search
    document.getElementById('globalSearch').addEventListener('input', debounce(handleSearch, 300));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Table sorting
    document.querySelectorAll('.modern-table th[data-sort]').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.dataset.sort;
            sortTable(column);
        });
    });
    
    // Select all
    document.getElementById('selectAllAccounts').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.account-select');
        checkboxes.forEach(cb => {
            cb.checked = this.checked;
            const id = cb.dataset.id;
            if (this.checked) {
                selectedAccounts.add(id);
            } else {
                selectedAccounts.delete(id);
            }
        });
        updateBulkBar();
        renderAccountsTable();
    });
    
    // Expiry range
    document.getElementById('expiryRange').addEventListener('change', function() {
        const settings = getNotificationSettings();
        settings.daysBefore = parseInt(this.value);
        saveNotificationSettings(settings);
        renderExpiringCards();
    });
    
    // Send manual notifications
    document.getElementById('sendManualNotify').addEventListener('click', async function() {
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        const result = await checkAndNotify(true);
        
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane"></i> Send Notifications Now';
        
        if (result && result.length > 0) {
            showToast(`Sent ${result.length} notifications`, 'success');
        } else {
            showToast('No notifications to send', 'info');
        }
    });
    
    // Export buttons
    document.getElementById('exportBtn').addEventListener('click', () => {
        openExportMenu();
    });
    
    // Bulk upload
    document.getElementById('bulkUploadBtn')?.addEventListener('click', openBulkUploadModal);
    document.getElementById('bulkUpload')?.addEventListener('click', processBulkUpload);
    document.getElementById('bulkCancel')?.addEventListener('click', () => {
        document.getElementById('bulkUploadModal').classList.remove('active');
    });
    
    // Confirm modal
    document.getElementById('confirmYes').addEventListener('click', function() {
        const mode = this.dataset.action;
        const id = this.dataset.id;
        if (mode === 'bulk-delete') {
            bulkDeleteSelected(true);
        } else if (id) {
            deleteAccount(id);
        }
        document.getElementById('confirmModal').classList.remove('active');
    });
    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('active');
    });
    
    // Bottom navigation (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            const action = this.dataset.action;
            if (action === 'menu') {
                document.getElementById('sidebar').classList.add('open');
                document.getElementById('sidebarBackdrop').classList.add('show');
                return;
            }
            if (page) navigateTo(page);
        });
    });
    
    // Mobile search overlay
    document.getElementById('searchToggle').addEventListener('click', () => {
        document.getElementById('mobileSearchOverlay').classList.add('active');
        setTimeout(() => document.getElementById('mobileSearch').focus(), 150);
    });
    document.getElementById('mobileSearchClose').addEventListener('click', closeMobileSearch);
    document.getElementById('mobileSearch').addEventListener('input', debounce((e) => {
        const value = e.target.value.trim();
        const msg = document.getElementById('mobileSearchMessage');
        if (msg) {
            msg.textContent = value ? 'Results shown in Accounts' : 'Type to search across emails and clients';
        }
        if (value) navigateTo('accounts');
        handleSearch(value);
    }, 250));
    
    // Bulk action bar
    document.getElementById('bulkCopyBtn').addEventListener('click', bulkCopySelected);
    document.getElementById('bulkExportBtn').addEventListener('click', bulkExportSelected);
    document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDeleteConfirm);
}

// Navigation
function navigateTo(page) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update bottom nav (mobile)
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Close mobile drawer & search when navigating
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('show');
    
    // Update pages
    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    // Update topbar
    const titles = {
        dashboard: ['Dashboard', 'Overview of your email accounts'],
        accounts: ['Accounts', 'Manage all your email accounts'],
        expiring: ['Expiring', 'Accounts that need attention'],
        problems: ['Problems', 'Accounts with issues'],
        analytics: ['Analytics', 'Insights and statistics'],
        settings: ['Settings', 'Configure your preferences']
    };
    
    const [title, subtitle] = titles[page] || ['Page', ''];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;
    
    currentPage = page;
    
    // Refresh data if needed
    if (page === 'dashboard') renderDashboard();
    if (page === 'accounts') renderAccountsTable();
    if (page === 'expiring') renderExpiringCards();
    if (page === 'problems') renderProblemAccounts();
    if (page === 'analytics') updateCharts();
}

// Toggle theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.getElementById('themeToggle').innerHTML = isDarkMode ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
}

// Open add account modal
function openAddAccountModal() {
    document.getElementById('accountModalTitle').textContent = 'Add New Account';
    document.getElementById('accountForm').reset();
    document.getElementById('accountForm').dataset.editId = '';
    document.getElementById('modalSave').textContent = 'Save Account';
    document.getElementById('accountModal').classList.add('active');
    
    // Set default day
    const today = new Date().getDate();
    document.getElementById('formDay').value = today;
}

// Close account modal
function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('active');
}

// Save account form
async function saveAccountForm() {
    const form = document.getElementById('accountForm');
    const id = form.dataset.editId;
    
    const client = document.getElementById('formClient').value.trim();
    const email = document.getElementById('formEmail').value.trim();
    const day = document.getElementById('formDay').value.trim();
    const replacement = document.getElementById('formReplacement').value.trim();
    const notes = document.getElementById('formNotes').value.trim();
    const hasProblem = document.getElementById('formHasProblem').checked;
    
    // Validate
    if (!client) {
        showToast('Client name is required', 'error');
        return;
    }
    if (!email || !validateEmail(email)) {
        showToast('Valid email is required', 'error');
        return;
    }
    if (!day || !validateDay(day)) {
        showToast('Valid day (1-31) is required', 'error');
        return;
    }
    
    try {
        const data = {
            client,
            email,
            date: String(day),
            replacementEmail: replacement,
            problemNote: notes,
            hasProblem
        };
        
        if (id) {
            // Update existing
            await updateAccount(id, data);
            const account = window.accounts.find(a => a.id === id);
            if (account) Object.assign(account, data);
            showToast('Account updated!', 'success');
        } else {
            // Create new
            const newId = await saveAccount(data);
            window.accounts.push({ id: newId, ...data });
            window.clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean);
            showToast('Account added!', 'success');
        }
        
        closeAccountModal();
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
        
    } catch (error) {
        showToast('Error saving account', 'error');
        console.error(error);
    }
}

// Delete account
async function deleteAccount(id) {
    try {
        await db.collection('accounts').doc(id).delete();
        window.accounts = window.accounts.filter(a => a.id !== id);
        selectedAccounts.delete(id);
        window.clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean);
        showToast('Account deleted', 'success');
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
    } catch (error) {
        showToast('Error deleting account', 'error');
    }
}

// Handle search
function handleSearch(query) {
    if (!query) {
        renderAccountsTable();
        return;
    }
    
    const filtered = window.accounts.filter(a => {
        const search = query.toLowerCase();
        return a.email.toLowerCase().includes(search) ||
               a.client.toLowerCase().includes(search) ||
               (a.replacementEmail && a.replacementEmail.toLowerCase().includes(search));
    });
    
    renderAccountsTable(filtered);
}

// Close mobile search overlay
function closeMobileSearch() {
    const overlay = document.getElementById('mobileSearchOverlay');
    if (overlay) overlay.classList.remove('active');
    const input = document.getElementById('mobileSearch');
    if (input) input.value = '';
    const msg = document.getElementById('mobileSearchMessage');
    if (msg) msg.textContent = 'Type to search across emails and clients';
    renderAccountsTable();
}

// Bulk actions: get selected accounts
function getSelectedAccounts() {
    return window.accounts.filter(a => selectedAccounts.has(a.id));
}

// Copy all selected emails
function bulkCopySelected() {
    const emails = getSelectedAccounts().map(a => a.email);
    if (emails.length === 0) return;
    copyToClipboard(emails.join('\n'));
}

// Export selected accounts
function bulkExportSelected() {
    const selected = getSelectedAccounts();
    if (selected.length === 0) return;
    const choice = confirm(`Export ${selected.length} account(s) as:\n\nOK = CSV\nCancel = JSON`);
    if (choice) {
        exportToCSV(selected);
    } else {
        exportToJSON(selected);
    }
}

// Confirm bulk delete
function bulkDeleteConfirm() {
    const count = selectedAccounts.size;
    if (count === 0) return;
    document.getElementById('confirmMessage').textContent = 
        `Delete ${count} selected account(s)? This cannot be undone.`;
    document.getElementById('confirmModal').classList.add('active');
    document.getElementById('confirmYes').dataset.action = 'bulk-delete';
    document.getElementById('confirmYes').dataset.id = '';
}

// Delete all selected accounts
async function bulkDeleteSelected(run) {
    if (!run) return;
    
    try {
        const ids = Array.from(selectedAccounts);
        await batchOperation(ids.map(id => ({
            type: 'delete',
            ref: db.collection('accounts').doc(id)
        })));
        
        selectedAccounts.forEach(id => {
            window.accounts = window.accounts.filter(a => a.id !== id);
        });
        selectedAccounts.clear();
        window.clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean);
        updateBulkBar();
        showToast(`Deleted ${ids.length} accounts`, 'success');
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
    } catch (error) {
        showToast('Error deleting accounts', 'error');
        console.error(error);
    }
}

// Sort table
function sortTable(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    renderAccountsTable();
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl+K = focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('globalSearch').focus();
    }
    
    // Ctrl+N = new account
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAddAccountModal();
    }
    
    // Escape = close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(m => {
            m.classList.remove('active');
        });
    }
}

// Open export menu
function openExportMenu() {
    // Simple export selection
    const choice = confirm('Export as:\n\nOK = CSV\nCancel = JSON\n\n(Excel coming soon)');
    if (choice) {
        exportToCSV();
    } else {
        exportToJSON();
    }
}

// Open bulk upload modal
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
}

// Process bulk upload
async function processBulkUpload() {
    const input = document.getElementById('bulkInput').value.trim();
    if (!input) {
        showToast('Please paste some accounts', 'error');
        return;
    }
    
    const lines = input.split('\n').filter(l => l.trim());
    const toAdd = [];
    const errors = [];
    
    lines.forEach((line, i) => {
        const parts = line.trim().split(',').map(p => p.trim());
        const email = parts[0];
        let day = parts[1] || String(new Date().getDate());
        
        if (!email || !validateEmail(email)) {
            errors.push(`Line ${i + 1}: Invalid email`);
            return;
        }
        if (!validateDay(day)) {
            errors.push(`Line ${i + 1}: Invalid day (use 1-31)`);
            return;
        }
        
        const client = document.getElementById('bulkAutoClient')?.checked ? 
                       email.split('@')[1].split('.')[0] : 
                       'Bulk Import';
        
        toAdd.push({ client, email, date: String(day) });
    });
    
    if (errors.length) {
        showToast(errors.join('\n'), 'error');
        return;
    }
    
    try {
        for (const account of toAdd) {
            const id = await saveAccount({
                ...account,
                replacementEmail: '',
                hasProblem: false,
                problemNote: ''
            });
            window.accounts.push({ id, ...account, replacementEmail: '', hasProblem: false, problemNote: '' });
        }
        window.clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean);
        showToast(`Added ${toAdd.length} accounts`, 'success');
        document.getElementById('bulkUploadModal').classList.remove('active');
        document.getElementById('bulkInput').value = '';
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
    } catch (error) {
        showToast('Error uploading accounts', 'error');
    }
}

// Export for global access
window.navigateTo = navigateTo;
window.toggleTheme = toggleTheme;
window.openAddAccountModal = openAddAccountModal;
window.saveAccountForm = saveAccountForm;
window.closeAccountModal = closeAccountModal;
window.deleteAccount = deleteAccount;
window.handleSearch = handleSearch;
window.sortTable = sortTable;
window.openExportMenu = openExportMenu;
window.openBulkUploadModal = openBulkUploadModal;
window.processBulkUpload = processBulkUpload;
window.openAddAccountModal = openAddAccountModal;

console.log('🚀 EmailVault Pro loaded successfully!');