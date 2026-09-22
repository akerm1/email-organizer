// ============================================
// UI RENDERER
// ============================================

// State
let currentPage = 'dashboard';
let selectedAccounts = new Set();
let activeClient = '';
let currentSort = { column: null, direction: 'asc' };
let lastRenderedGroups = {};
let lastRenderedClientIds = [];

// ============================================
// SMALL HELPERS
// ============================================

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function emptyStateHTML(title, text) {
    return `
        <div class="empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
        </div>`;
}

// ============================================
// DASHBOARD / HOME
// ============================================

function renderDashboard() {
    const total = window.accounts.length;
    const expiring = window.accounts.filter(a => expiryStatusOnly(a) === 'expiring').length;
    const expired = window.accounts.filter(a => expiryStatusOnly(a) === 'expired').length;
    const problems = window.accounts.filter(a => a.hasProblem).length;

    setText('homeStatTotal', total);
    setText('homeStatExpiring', expiring);
    setText('homeStatExpired', expired);
    setText('totalBadge', total);
    setText('accountBadge', total);
    setText('expiringBadge', expiring);
    setText('problemBadge', problems);

    const bExp = document.getElementById('bottomExpiringBadge');
    const bPro = document.getElementById('bottomProblemBadge');
    if (bExp) {
        bExp.textContent = expiring;
        bExp.style.display = expiring > 0 ? 'flex' : 'none';
    }
    if (bPro) {
        bPro.textContent = problems;
        bPro.style.display = problems > 0 ? 'flex' : 'none';
    }

    if (typeof renderClientsHome === 'function') renderClientsHome();
}

// Check if account is expiring (within next 30 days)
function isExpiring(account) {
    const days = getDaysUntilExpiry(account.date);
    return days !== null && days <= 30 && days >= 0;
}

// ============================================
// EMAIL CARDS (shared by every list)
// ============================================

function accountCardHTML(account, opts = {}) {
    const isSelected = selectedAccounts.has(account.id);
    const days = getDaysUntilExpiry(account.date);
    let status = statusOfAccount(account);
    if (account.status === 'today') status = 'today';
    else if (account.status === 'upcoming') status = 'expiring';

    const labels = { problem: 'Problem', expired: 'Expired', today: 'Expires today', expiring: 'Expiring', ok: 'OK' };
    const daysLabel = days === null ? '—' : (days < 0 ? `${-days}d ago` : `${days}d`);
    const daysClass = days === null ? 'ok' : (days < 0 ? 'danger' : (days <= 7 ? 'warning' : 'ok'));

    const note = opts.problem && account.problemNote
        ? `<div class="email-card-note"><i class="fas fa-sticky-note"></i> ${escapeHtml(account.problemNote)}</div>`
        : '';
    const resolveBtn = opts.problem
        ? `<button type="button" class="btn btn-sm btn-success" onclick="resolveProblem('${account.id}')" title="Resolve"><i class="fas fa-check"></i> Resolve</button>`
        : '';
    const clientLine = opts.hideClient ? '' :
        `<span class="email-card-client"><i class="fas fa-user"></i> ${escapeHtml(account.client || 'Unassigned')}</span>`;

    return `
        <div class="email-card ${isSelected ? 'selected' : ''}">
            <label class="email-card-check">
                <input type="checkbox" class="account-select" data-id="${account.id}" ${isSelected ? 'checked' : ''} onchange="toggleAccountSelect('${account.id}')">
            </label>
            <div class="email-card-main">
                <div class="email-card-row">
                    <span class="email-card-email" title="${escapeHtml(account.email)}">${escapeHtml(account.email)}</span>
                    <span class="status-badge ${status}">${labels[status] || status}</span>
                </div>
                ${account.replacementEmail ? `<div class="email-card-replacement"><i class="fas fa-exchange-alt"></i> ${escapeHtml(account.replacementEmail)}</div>` : ''}
                <div class="email-card-meta">
                    ${clientLine}
                    <span><i class="fas fa-calendar-day"></i> Expires ${formatDateDisplay(account.date)}</span>
                    <span class="days-badge ${daysClass}">${daysLabel}</span>
                </div>
                ${note}
                <div class="email-card-actions">
                    ${resolveBtn}
                    <button type="button" class="btn btn-sm btn-ghost" onclick="editAccount('${account.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-sm btn-ghost" onclick="copyToClipboard('${escapeHtml(account.email)}')" title="Copy email"><i class="fas fa-copy"></i></button>
                    <button type="button" class="btn btn-sm btn-ghost btn-danger" onclick="deleteAccountConfirm('${account.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
}

function groupSectionHTML(group, opts = {}) {
    const ref = clientRef(group.name);
    lastRenderedGroups[`${opts.namespace}:${ref}`] = group.accounts.map(a => a.id);

    const counts = [];
    if (group.expired > 0) counts.push(`<span class="mini-badge danger"><i class="fas fa-times-circle"></i> ${group.expired}</span>`);
    if (group.expiring > 0) counts.push(`<span class="mini-badge warning"><i class="fas fa-clock"></i> ${group.expiring}</span>`);

    const allSel = group.accounts.length > 0 && group.accounts.every(a => selectedAccounts.has(a.id));

    return `
        <section class="account-group">
            <div class="group-header">
                <label class="group-select">
                    <input type="checkbox" class="select-all-client" data-client="${ref}" ${allSel ? 'checked' : ''}>
                    <span class="group-title">
                        <strong>${escapeHtml(group.name)}</strong>
                        <span class="group-counts">${group.accounts.length} emails ${counts.join(' ')}</span>
                    </span>
                </label>
                <button type="button" class="btn btn-sm btn-icon" onclick="viewClient('${ref}')" title="Open client"><i class="fas fa-chevron-right"></i></button>
            </div>
            <div class="group-card-list">
                ${group.accounts.map(a => accountCardHTML(a, opts)).join('')}
            </div>
        </section>`;
}

function clearGroupNamespace(ns) {
    Object.keys(lastRenderedGroups).forEach(k => {
        if (k.startsWith(ns + ':')) delete lastRenderedGroups[k];
    });
}

function sortByUrgency(list) {
    return list.slice().sort((a, b) => {
        const da = getDaysUntilExpiry(a.date);
        const db = getDaysUntilExpiry(b.date);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        if (da !== db) return da - db;
        return (a.email || '').localeCompare(b.email || '');
    });
}

// ============================================
// ALL EMAILS PAGE (grouped by client)
// ============================================

function renderAccountsTable(filtered = null) {
    const container = document.getElementById('groupedAccountsList');
    if (!container) return;

    const list = Array.isArray(filtered) ? filtered : window.accounts;
    const groups = groupAccountsByClient(sortByUrgency(list));

    clearGroupNamespace('accounts');

    const vc = document.getElementById('visibleCount');
    if (vc) vc.textContent = list.length;

    const allSel = list.length > 0 && list.filter(a => selectedAccounts.has(a.id)).length === list.length;
    const selBox = document.getElementById('selectAllVisible');
    if (selBox) selBox.checked = allSel;

    if (groups.length === 0) {
        container.innerHTML = emptyStateHTML('No accounts found', 'Try clearing your search or filters.');
        return;
    }

    container.innerHTML = groups.map(g => groupSectionHTML(g, { namespace: 'accounts' })).join('');
}

// ============================================
// EXPIRING PAGE (grouped by client, selectable)
// ============================================

function renderExpiringCards() {
    const grid = document.getElementById('expiringGrid');
    if (!grid) return;

    const windowDays = getNotificationSettings().daysBefore;
    let expiring = getAccountsWithin(windowDays);

    const cfEl = document.getElementById('expiringClientFilter');
    const cf = cfEl ? cfEl.value : 'all';
    if (cf !== 'all') expiring = expiring.filter(a => a.client === cf);

    const sfEl = document.getElementById('expiringStatusFilter');
    const sf = sfEl ? sfEl.value : 'all';
    if (sf !== 'all') expiring = expiring.filter(a => a.status === sf);

    const groups = groupAccountsByClient(sortByUrgency(expiring));
    clearGroupNamespace('expiring');

    if (groups.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>All Clear!</h3>
                <p>No accounts match the current filters in this timeframe.</p>
            </div>`;
        return;
    }

    grid.innerHTML = groups.map(g => groupSectionHTML(g, { namespace: 'expiring' })).join('');
}

// ============================================
// PROBLEMS PAGE (grouped by client, selectable)
// ============================================

function renderProblemAccounts() {
    const grid = document.getElementById('problemsGrid');
    if (!grid) return;

    let problems = window.accounts.filter(a => a.hasProblem);

    const cfEl = document.getElementById('problemClientFilter');
    const cf = cfEl ? cfEl.value : 'all';
    if (cf !== 'all') problems = problems.filter(a => a.client === cf);

    const searchEl = document.getElementById('problemSearch');
    const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
    if (query) {
        problems = problems.filter(a =>
            (a.email || '').toLowerCase().includes(query) ||
            (a.problemNote || '').toLowerCase().includes(query) ||
            (a.client || '').toLowerCase().includes(query)
        );
    }

    const groups = groupAccountsByClient(sortByUrgency(problems));
    clearGroupNamespace('problems');

    if (groups.length === 0) {
        grid.innerHTML = emptyStateHTML('No Problems!', 'All accounts are in good standing.');
        return;
    }

    grid.innerHTML = groups.map(g => groupSectionHTML(g, { namespace: 'problems', problem: true })).join('');
}

// ============================================
// CLIENT DETAIL PAGE
// ============================================

function renderClientDetail(name) {
    activeClient = name;

    const nameEl = document.getElementById('clientDetailName');
    if (nameEl) nameEl.textContent = name;

    let list = window.accounts.filter(a => (a.client || 'Unassigned') === name);

    const status = document.querySelector('#clientStatusChips .chip.active')?.dataset.status || 'all';
    if (status !== 'all') list = list.filter(a => expiryStatusOnly(a) === status);

    list = sortByUrgency(list);
    lastRenderedClientIds = list.map(a => a.id);

    const total = window.accounts.filter(a => (a.client || 'Unassigned') === name).length;
    const expired = list.filter(a => expiryStatusOnly(a) === 'expired').length;
    const expiring = list.filter(a => expiryStatusOnly(a) === 'expiring').length;

    setText('clientDetailTotal', `${total} email${total === 1 ? '' : 's'}`);

    const redB = document.getElementById('clientDetailExpired');
    if (redB) { redB.textContent = expired; redB.style.display = expired > 0 ? 'inline-flex' : 'none'; }
    const orgB = document.getElementById('clientDetailExpiring');
    if (orgB) { orgB.textContent = expiring; orgB.style.display = expiring > 0 ? 'inline-flex' : 'none'; }

    const selBox = document.getElementById('clientSelectAll');
    if (selBox) selBox.checked = list.length > 0 && list.filter(a => selectedAccounts.has(a.id)).length === list.length;
    setText('clientSelectCount', list.length);

    const container = document.getElementById('clientDetailList');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = emptyStateHTML('No emails', 'This client has no matching emails.');
        return;
    }

    container.innerHTML = list.map(a => accountCardHTML(a, { hideClient: true })).join('');
}

// ============================================
// SELECTION
// ============================================

// Toggle account selection
function toggleAccountSelect(id) {
    if (selectedAccounts.has(id)) {
        selectedAccounts.delete(id);
    } else {
        selectedAccounts.add(id);
    }
    updateBulkBar();
    refreshAllViews();
}

// Select/deselect a specific set of ids
function selectInIds(ids, checked) {
    (ids || []).forEach(id => {
        if (checked) selectedAccounts.add(id);
        else selectedAccounts.delete(id);
    });
    updateBulkBar();
    refreshAllViews();
}

// Select/deselect every account belonging to a client
function selectAllAccountsOfClient(name, checked) {
    const ids = window.accounts.filter(a => (a.client || 'Unassigned') === name).map(a => a.id);
    selectInIds(ids, checked);
}

// Toggle "select all for this client" from a client card on the home screen
function selectAllForClientRef(ref) {
    const name = clientNameFromRef(ref);
    if (!name) return;
    const ids = window.accounts.filter(a => (a.client || 'Unassigned') === name).map(a => a.id);
    const allSelected = ids.length > 0 && ids.filter(id => selectedAccounts.has(id)).length === ids.length;
    selectInIds(ids, !allSelected);
    showToast(allSelected ? `Deselected ${ids.length} email(s) for ${name}` : `Selected ${ids.length} email(s) for ${name}`, 'info');
}

// Select/deselect all accounts currently shown by the main filters
function selectAllVisibleAccounts(checked) {
    const list = typeof getFilteredAccounts === 'function' ? getFilteredAccounts() : window.accounts;
    selectInIds(list.map(a => a.id), checked);
}

// Handle a per-client group 'select all' checkbox (event delegation target)
function handleGroupSelectAll(el) {
    const ns = currentPage === 'expiring' ? 'expiring' : currentPage === 'problems' ? 'problems' : 'accounts';
    const ids = lastRenderedGroups[`${ns}:${el.dataset.client}`] || [];
    selectInIds(ids, el.checked);
}

// Select/deselect the currently shown emails on the client detail page
function selectAllClientDetail(checked) {
    selectInIds(lastRenderedClientIds, checked);
}

// Clear the entire selection
function clearSelection() {
    selectedAccounts.clear();
    updateBulkBar();
    refreshAllViews();
}

// Update bulk actions bar
function updateBulkBar() {
    const bar = document.getElementById('bulkActionsBar');
    if (!bar) return;

    const count = selectedAccounts.size;
    if (count > 0) {
        bar.style.display = 'flex';
        document.getElementById('bulkCount').textContent = count;
    } else {
        bar.style.display = 'none';
    }
}

// ============================================
// COMMON REFRESH
// ============================================

function refreshAllViews() {
    renderDashboard();
    renderAccountsTable(getFilteredAccounts());
    renderExpiringCards();
    renderProblemAccounts();
    if (activeClient) renderClientDetail(activeClient);
}

// ============================================
// PROBLEM RESOLUTION
// ============================================

// Resolve problem
async function resolveProblem(id) {
    const account = window.accounts.find(a => a.id === id);
    if (!account) return;

    try {
        account.hasProblem = false;
        account.problemNote = '';
        await updateAccount(id, account);
        selectedAccounts.delete(id);
        showToast('Problem resolved!', 'success');
        refreshAllViews();
        updateCharts();
    } catch (error) {
        showToast('Error resolving problem', 'error');
    }
}

// ============================================
// ACCOUNT EDIT / DELETE
// ============================================

// Edit account modal
function editAccount(id) {
    const account = window.accounts.find(a => a.id === id);
    if (!account) return;

    setAddModalMode('single', false);
    document.getElementById('accountModal').classList.remove('add-mode');
    populateClientOptionsIfChanged();
    document.getElementById('accountModalTitle').textContent = 'Edit Account';
    document.getElementById('formClient').value = account.client;
    document.getElementById('formEmail').value = account.email;
    document.getElementById('formDay').value = extractDay(account.date) || '';
    refreshDayPicker('formDay', 'formDayPicker');
    document.getElementById('formReplacement').value = account.replacementEmail || '';
    document.getElementById('formNotes').value = account.problemNote || '';
    document.getElementById('formHasProblem').checked = account.hasProblem;

    document.getElementById('accountForm').dataset.editId = id;
    document.getElementById('modalSave').innerHTML = '<i class="fas fa-edit"></i> Update Account';
    document.getElementById('modalSave').disabled = false;
    document.getElementById('accountModal').classList.add('active');
}

// Delete account confirmation
function deleteAccountConfirm(id) {
    const account = window.accounts.find(a => a.id === id);
    if (!account) return;

    document.getElementById('confirmMessage').textContent =
        `Delete account ${account.email} for ${account.client}?`;
    document.getElementById('confirmModal').classList.add('active');
    const yesBtn = document.getElementById('confirmYes');
    yesBtn.dataset.id = account.id;
    delete yesBtn.dataset.action;
}

// Export UI functions
window.renderDashboard = renderDashboard;
window.renderAccountsTable = renderAccountsTable;
window.renderExpiringCards = renderExpiringCards;
window.renderProblemAccounts = renderProblemAccounts;
window.renderClientDetail = renderClientDetail;
window.refreshAllViews = refreshAllViews;
window.toggleAccountSelect = toggleAccountSelect;
window.selectInIds = selectInIds;
window.selectAllAccountsOfClient = selectAllAccountsOfClient;
window.selectAllForClientRef = selectAllForClientRef;
window.selectAllVisibleAccounts = selectAllVisibleAccounts;
window.handleGroupSelectAll = handleGroupSelectAll;
window.selectAllClientDetail = selectAllClientDetail;
window.clearSelection = clearSelection;
window.updateBulkBar = updateBulkBar;
window.editAccount = editAccount;
window.deleteAccountConfirm = deleteAccountConfirm;
window.resolveProblem = resolveProblem;