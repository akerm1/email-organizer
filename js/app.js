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
        updateSettingsStatus();
        
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
    document.getElementById('globalSearch').addEventListener('input', debounce(applyFilters, 300));
    
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
        renderAccountsTable(getFilteredAccounts());
    });
    
    // Bulk select toolbar button: select/deselect all filtered accounts
    document.getElementById('bulkSelectBtn').addEventListener('click', () => {
        const list = getFilteredAccounts();
        if (list.length === 0) return;
        const allSelected = list.every(a => selectedAccounts.has(a.id));
        list.forEach(a => {
            if (allSelected) {
                selectedAccounts.delete(a.id);
            } else {
                selectedAccounts.add(a.id);
            }
        });
        document.getElementById('selectAllAccounts').checked = !allSelected;
        updateBulkBar();
        renderAccountsTable(list);
    });
    
    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPageIndex > 0) {
            currentPageIndex--;
            renderAccountsTable(getFilteredAccounts());
        }
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        const total = getFilteredAccounts().length;
        if ((currentPageIndex + 1) * PAGE_SIZE < total) {
            currentPageIndex++;
            renderAccountsTable(getFilteredAccounts());
        }
    });
    
    // Resolve all problems
    document.getElementById('resolveAllBtn').addEventListener('click', resolveAllProblems);
    
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
    
    // Bulk upload shortcut (opens Add modal on the Bulk tab)
    document.getElementById('bulkUploadBtn')?.addEventListener('click', openBulkAdd);
    
    // Add modal tabs
    document.getElementById('addTabSingle').addEventListener('click', () => setAddModalMode('single'));
    document.getElementById('addTabBulk').addEventListener('click', () => setAddModalMode('bulk'));
    
    // Bulk panel live preview
    document.getElementById('bulkInput').addEventListener('input', debounce(updateBulkPreview, 150));
    document.getElementById('bulkClient').addEventListener('change', updateBulkPreview);
    document.getElementById('bulkDay').addEventListener('input', () => {
        refreshDayPicker('bulkDay', 'bulkDayPicker');
        updateBulkPreview();
    });
    
    // Single form day picker sync
    document.getElementById('formDay').addEventListener('input', () => refreshDayPicker('formDay', 'formDayPicker'));
    
    // Accounts filters
    document.getElementById('clientFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    
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
        applyFilters();
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

// Add modal mode state
let addModalMode = 'single';

// Open add account modal (single mode)
function openAddAccountModal() {
    setAddModalMode('single');
    document.getElementById('accountModal').classList.add('add-mode');
    document.getElementById('accountModalTitle').textContent = 'Add Account';
    document.getElementById('accountForm').reset();
    document.getElementById('accountForm').dataset.editId = '';
    populateClientOptionsIfChanged();
    const today = new Date().getDate();
    document.getElementById('formDay').value = today;
    refreshDayPicker('formDay', 'formDayPicker');
    document.getElementById('accountModal').classList.add('active');
}

// Open add modal directly on the Bulk tab
function openBulkAdd() {
    setAddModalMode('bulk');
    document.getElementById('accountModal').classList.add('add-mode');
    document.getElementById('accountModalTitle').textContent = 'Add Multiple Accounts';
    document.getElementById('bulkInput').value = '';
    document.getElementById('bulkDay').value = new Date().getDate();
    populateClientOptionsIfChanged();
    refreshDayPicker('bulkDay', 'bulkDayPicker');
    updateBulkPreview();
    document.getElementById('accountModal').classList.add('active');
}

// Switch the active tab in the add modal
function setAddModalMode(mode, showTabs = true) {
    addModalMode = mode;
    document.getElementById('addTabSingle').classList.toggle('active', mode === 'single');
    document.getElementById('addTabBulk').classList.toggle('active', mode === 'bulk');
    document.getElementById('addPanelSingle').style.display = mode === 'single' ? '' : 'none';
    document.getElementById('addPanelBulk').style.display = mode === 'bulk' ? '' : 'none';
    document.getElementById('accountModal').querySelector('.modal-tabs')?.classList.toggle('hidden', !showTabs);
    
    const saveBtn = document.getElementById('modalSave');
    if (mode === 'bulk') {
        saveBtn.innerHTML = '<i class="fas fa-layer-group"></i> Add <span id="saveCount"></span> Accounts';
        saveBtn.disabled = true;
    } else {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Account';
        saveBtn.disabled = false;
    }
}

// Build/refresh a 1-31 day chip picker
function refreshDayPicker(inputId, pickerId) {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId);
    if (!picker || !input) return;
    const current = parseInt(input.value, 10);
    picker.innerHTML = '';
    for (let d = 1; d <= 31; d++) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'day-chip' + (d === current ? ' active' : '');
        chip.textContent = d;
        chip.addEventListener('click', () => {
            input.value = d;
            refreshDayPicker(inputId, pickerId);
            if (inputId === 'bulkDay') updateBulkPreview();
        });
        picker.appendChild(chip);
    }
}

// Populate client options (datalist, bulk select, client filter) once per data change
let lastClientOptionsKey = '';
function populateClientOptionsIfChanged() {
    const clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean).sort();
    const key = clients.join('\u0001');
    if (key === lastClientOptionsKey) return;
    lastClientOptionsKey = key;
    populateClientOptions(clients);
}

function populateClientOptions(clients) {
    const dl = document.getElementById('clientList');
    if (dl) dl.innerHTML = clients.map(c => `<option value="${escapeHtml(c)}"></option>`).join('');
    
    const sel = document.getElementById('bulkClient');
    if (sel) {
        const current = sel.value;
        sel.innerHTML = '<option value="auto">Auto-detect from email</option>' +
            '<option value="Bulk Import">Bulk Import</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
        if ([...sel.options].some(o => o.value === current)) sel.value = current;
    }
    
    const cf = document.getElementById('clientFilter');
    if (cf) {
        const current = cf.value;
        cf.innerHTML = '<option value="all">All Clients</option>';
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            cf.appendChild(opt);
        });
        if (current !== 'all' && clients.includes(current)) cf.value = current;
    }
}

// Parse a single bulk line into { email, day, error? }
function parseBulkLine(line) {
    const trimmed = (line || '').trim();
    if (!trimmed) return null;
    let email = trimmed;
    let day = null;
    if (trimmed.includes(',')) {
        const parts = trimmed.split(',').map(p => p.trim());
        email = parts[0];
        if (parts[1]) day = parts[1].trim();
    } else if (trimmed.includes('.')) {
        const parts = trimmed.split('.');
        const last = parts[parts.length - 1].trim();
        if (validateDay(last)) {
            day = last;
            email = parts.slice(0, -1).join('.').trim();
        }
    }
    return { email, day };
}

// Resolve which client a bulk email gets
function computeClient(choice, email) {
    if (choice === 'auto') {
        const domain = ((email.split('@')[1] || '').split('.')[0] || '').trim();
        return domain || 'Bulk Import';
    }
    if (choice === 'Bulk Import') return 'Bulk Import';
    return choice;
}

// Parse the entire bulk textarea into validated rows
function computeBulkRows() {
    const text = document.getElementById('bulkInput').value || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const defaultDay = parseInt(document.getElementById('bulkDay').value, 10) || new Date().getDate();
    const clientChoice = document.getElementById('bulkClient').value || 'auto';
    const rows = [];
    lines.forEach((line, i) => {
        const parsed = parseBulkLine(line);
        if (!parsed || !parsed.email || !validateEmail(parsed.email)) {
            rows.push({ lineNo: i + 1, email: line, error: 'Invalid email address' });
            return;
        }
        const day = parsed.day ? String(parsed.day) : String(defaultDay);
        if (!validateDay(day)) {
            rows.push({ lineNo: i + 1, email: parsed.email, error: 'Invalid day (use 1-31)' });
            return;
        }
        rows.push({ lineNo: i + 1, email: parsed.email, day, client: computeClient(clientChoice, parsed.email) });
    });
    return rows;
}

// Live preview + save button states for the bulk tab
function updateBulkPreview() {
    const rows = computeBulkRows();
    const listEl = document.getElementById('bulkPreviewList');
    const summaryEl = document.getElementById('bulkSummary');
    const linesCount = (document.getElementById('bulkInput').value || '').split('\n').filter(l => l.trim()).length;
    const valid = rows.filter(r => !r.error).length;
    const errors = rows.length - valid;
    
    if (linesCount === 0) {
        listEl.innerHTML = '';
        summaryEl.textContent = 'Paste emails above to see a preview';
        summaryEl.className = 'bulk-summary';
    } else {
        listEl.innerHTML = rows.map(r => `
            <div class="preview-row ${r.error ? 'error' : ''}">
                <span class="preview-line">${r.lineNo}.</span>
                <span class="preview-email">${escapeHtml(r.email)}</span>
                <span class="preview-day">${r.error ? escapeHtml(r.error) : `Day ${r.day} · ${escapeHtml(r.client)}`}</span>
            </div>
        `).join('');
        summaryEl.textContent = `${valid} ready to add · ${errors} error${errors === 1 ? '' : 's'}`;
        summaryEl.className = 'bulk-summary ' + (errors > 0 ? 'has-errors' : (valid > 0 ? 'ok' : ''));
    }
    
    const saveBtn = document.getElementById('modalSave');
    const countSpan = document.getElementById('saveCount');
    if (addModalMode === 'bulk' && saveBtn) {
        saveBtn.disabled = valid === 0;
        if (countSpan) countSpan.textContent = valid > 0 ? ` ${valid}` : '';
    }
}

// Save all valid rows from the bulk panel
async function saveBulkAccounts() {
    const rows = computeBulkRows();
    const valid = rows.filter(r => !r.error);
    if (valid.length === 0) {
        showToast('No valid accounts to add', 'error');
        return;
    }
    
    try {
        for (const row of valid) {
            const data = {
                client: row.client,
                email: row.email,
                date: String(row.day),
                replacementEmail: '',
                hasProblem: false,
                problemNote: ''
            };
            const id = await saveAccount(data);
            window.accounts.push({ id, ...data });
        }
        window.clients = [...new Set(window.accounts.map(a => a.client))].filter(Boolean);
        lastClientOptionsKey = '';
        
        const errors = rows.length - valid.length;
        showToast(
            `Added ${valid.length} account${valid.length > 1 ? 's' : ''}${errors > 0 ? ` · ${errors} skipped` : ''}`,
            errors > 0 ? 'warning' : 'success'
        );
        document.getElementById('bulkInput').value = '';
        closeAccountModal();
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
    } catch (error) {
        showToast('Error adding accounts', 'error');
        console.error(error);
    }
}

// Combine search + client + status filters
function statusOf(account, days) {
    if (account.hasProblem) return 'problem';
    if (days === null) return 'ok';
    if (days < 0) return 'expired';
    if (days <= 7) return 'expiring';
    return 'ok';
}

function getFilteredAccounts() {
    let list = window.accounts.slice();
    const q = ((document.getElementById('globalSearch')?.value || '') +
               (document.getElementById('mobileSearch')?.value || '')).trim().toLowerCase();
    if (q) {
        list = list.filter(a =>
            a.email.toLowerCase().includes(q) ||
            a.client.toLowerCase().includes(q) ||
            (a.replacementEmail || '').toLowerCase().includes(q)
        );
    }
    const client = document.getElementById('clientFilter')?.value || 'all';
    if (client !== 'all') list = list.filter(a => a.client === client);
    const status = document.getElementById('statusFilter')?.value || 'all';
    if (status !== 'all') {
        list = list.filter(a => statusOf(a, getDaysUntilExpiry(a.date)) === status);
    }
    return list;
}

function applyFilters() {
    currentPageIndex = 0;
    renderAccountsTable(getFilteredAccounts());
}

// Resolve every problem account at once
async function resolveAllProblems() {
    const problems = window.accounts.filter(a => a.hasProblem);
    if (problems.length === 0) {
        showToast('No problems to resolve', 'info');
        return;
    }
    if (!confirm(`Resolve ${problems.length} problem account(s)?`)) return;
    
    try {
        await batchOperation(problems.map(a => ({
            type: 'update',
            ref: db.collection('accounts').doc(a.id),
            data: { hasProblem: false, problemNote: '' }
        })));
        problems.forEach(a => {
            a.hasProblem = false;
            a.problemNote = '';
        });
        showToast(`Resolved ${problems.length} problem(s)`, 'success');
        renderDashboard();
        renderAccountsTable();
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
    } catch (error) {
        showToast('Error resolving problems', 'error');
        console.error(error);
    }
}

// Close account modal
function closeAccountModal() {
    document.getElementById('accountModal').classList.remove('active');
}

// Save account form (single or bulk)
async function saveAccountForm() {
    if (addModalMode === 'bulk') {
        await saveBulkAccounts();
        return;
    }
    
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
            lastClientOptionsKey = '';
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
        currentPageIndex = 0;
        renderAccountsTable();
        return;
    }
    
    currentPageIndex = 0;
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
    currentPageIndex = 0;
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
    renderAccountsTable(getFilteredAccounts());
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
    const choice = confirm('Export as:\n\nOK = CSV\nCancel = JSON\n\nTip: Excel and more in Settings > Backup');
    if (choice) {
        exportToCSV();
    } else {
        exportToJSON();
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
window.openAddAccountModal = openAddAccountModal;

console.log('🚀 EmailVault Pro loaded successfully!');