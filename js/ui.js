// ============================================
// UI RENDERER
// ============================================

// State
let currentPage = 'dashboard';
let selectedAccounts = new Set();
let currentSort = { column: null, direction: 'asc' };
let currentPageIndex = 0;
const PAGE_SIZE = 25;

// Render dashboard
function renderDashboard() {
    const total = window.accounts.length;
    const expiring = getExpiringAccounts().length;
    const expired = window.accounts.filter(a => {
        const days = getDaysUntilExpiry(a.date);
        return days !== null && days < 0;
    }).length;
    const clients = window.clients.length;
    const healthy = window.accounts.filter(a => !a.hasProblem && !isExpiring(a)).length;
    
    // Update stats
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statExpiring').textContent = expiring;
    document.getElementById('statExpired').textContent = expired;
    document.getElementById('statClients').textContent = clients;
    document.getElementById('statHealthy').textContent = healthy;
    
    // Update badges
    document.getElementById('totalBadge').textContent = total;
    document.getElementById('accountBadge').textContent = total;
    document.getElementById('expiringBadge').textContent = expiring;
    document.getElementById('problemBadge').textContent = window.accounts.filter(a => a.hasProblem).length;
    
    // Update bottom nav badges (mobile)
    const bottomExpiring = document.getElementById('bottomExpiringBadge');
    const bottomProblem = document.getElementById('bottomProblemBadge');
    if (bottomExpiring) bottomExpiring.textContent = expiring;
    if (bottomProblem) bottomProblem.textContent = window.accounts.filter(a => a.hasProblem).length;
    if (bottomExpiring) bottomExpiring.style.display = expiring > 0 ? 'flex' : 'none';
    if (bottomProblem) bottomProblem.style.display = window.accounts.filter(a => a.hasProblem).length > 0 ? 'flex' : 'none';
    
    // Render activity
    renderActivity();
}

// Check if account is expiring
function isExpiring(account) {
    const days = getDaysUntilExpiry(account.date);
    return days !== null && days <= 30 && days >= 0;
}

// Render activity timeline
function renderActivity() {
    const timeline = document.getElementById('activityTimeline');
    const recent = [...window.accounts]
        .sort((a, b) => {
            const aDays = getDaysUntilExpiry(a.date) || 999;
            const bDays = getDaysUntilExpiry(b.date) || 999;
            return aDays - bDays;
        })
        .slice(0, 10);
    
    if (recent.length === 0) {
        timeline.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No accounts yet. Start by adding your first account!</p>
            </div>
        `;
        return;
    }
    
    timeline.innerHTML = recent.map(account => {
        const days = getDaysUntilExpiry(account.date);
        const status = account.hasProblem ? 'problem' : 
                      days < 0 ? 'expired' :
                      days === 0 ? 'today' :
                      days <= 7 ? 'warning' : 'ok';
        const icon = account.hasProblem ? 'fa-exclamation-triangle' :
                    days < 0 ? 'fa-times-circle' :
                    days === 0 ? 'fa-clock' : 'fa-check-circle';
        const color = account.hasProblem ? 'var(--danger)' :
                     days < 0 ? 'var(--danger)' :
                     days === 0 ? 'var(--warning)' :
                     days <= 7 ? 'var(--warning)' : 'var(--success)';
        
        return `
            <div class="activity-item">
                <div class="activity-icon" style="color: ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">
                        <strong>${escapeHtml(account.email)}</strong>
                        <span class="activity-client">${escapeHtml(account.client)}</span>
                    </div>
                    <div class="activity-meta">
                        ${days !== null ? `${days < 0 ? 'Expired' : `${days}d left`}` : 'No date'}
                        ${account.replacementEmail ? `→ ${escapeHtml(account.replacementEmail)}` : ''}
                    </div>
                </div>
                <div class="activity-time">
                    <span class="status-badge ${status}">${status}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Render accounts table
function renderAccountsTable(filteredAccounts = null) {
    const accountsToRender = filteredAccounts || window.accounts;
    const tbody = document.getElementById('accountsTableBody');
    
    // Sort
    if (currentSort.column) {
        accountsToRender.sort((a, b) => {
            let valA = a[currentSort.column] || '';
            let valB = b[currentSort.column] || '';
            
            if (currentSort.column === 'date') {
                valA = extractDay(a.date) || 999;
                valB = extractDay(b.date) || 999;
            } else if (currentSort.column === 'days') {
                valA = getDaysUntilExpiry(a.date) || 999;
                valB = getDaysUntilExpiry(b.date) || 999;
            } else if (currentSort.column === 'status') {
                valA = a.hasProblem ? 'problem' : 'ok';
                valB = b.hasProblem ? 'problem' : 'ok';
            } else {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            
            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Pagination
    const start = currentPageIndex * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageAccounts = accountsToRender.slice(start, end);
    
    if (pageAccounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No accounts found</p>
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('accountCount').textContent = '0 accounts';
        document.getElementById('pageInfo').textContent = 'Page 0 of 0';
        return;
    }
    
    tbody.innerHTML = pageAccounts.map(account => {
        const isSelected = selectedAccounts.has(account.id);
        const days = getDaysUntilExpiry(account.date);
        const status = account.hasProblem ? 'problem' :
                      days < 0 ? 'expired' :
                      days <= 7 ? 'expiring' : 'ok';
        const statusLabel = account.hasProblem ? 'Problem' :
                           days < 0 ? 'Expired' :
                           days <= 7 ? 'Expiring' : 'OK';
        const daysLabel = days !== null ? 
                         (days < 0 ? `${days}d` : `${days}d`) : 
                         '—';
        const daysClass = days !== null ?
                         (days < 0 ? 'expired' :
                          days === 0 ? 'danger' :
                          days <= 7 ? 'warning' : 'ok') :
                         'ok';
        
        return `
            <tr class="${isSelected ? 'selected' : ''} ${account.hasProblem ? 'problem-row' : ''}">
                <td class="checkbox-col cell-check">
                    <input type="checkbox" class="account-select" 
                           data-id="${account.id}" 
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleAccountSelect('${account.id}')">
                </td>
                <td class="cell-client"><strong>${escapeHtml(account.client)}</strong></td>
                <td class="cell-email" data-label="Email">${escapeHtml(account.email)}</td>
                <td class="cell-expiry" data-label="Expiry Day">${formatDateDisplay(account.date)}</td>
                <td class="cell-replacement" data-label="Replacement">${account.replacementEmail ? escapeHtml(account.replacementEmail) : '—'}</td>
                <td class="cell-status" data-label="Status"><span class="status-badge ${status}">${statusLabel}</span></td>
                <td class="cell-days" data-label="Days Left"><span class="days-badge ${daysClass}">${daysLabel}</span></td>
                <td class="cell-actions">
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-ghost" onclick="editAccount('${account.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="copyToClipboard('${escapeHtml(account.email)}')" title="Copy">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="deleteAccountConfirm('${account.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('accountCount').textContent = 
        `${accountsToRender.length} account${accountsToRender.length > 1 ? 's' : ''}`;
    document.getElementById('pageInfo').textContent = 
        `Page ${currentPageIndex + 1} of ${Math.ceil(accountsToRender.length / PAGE_SIZE) || 1}`;
}

// Toggle account selection
function toggleAccountSelect(id) {
    if (selectedAccounts.has(id)) {
        selectedAccounts.delete(id);
    } else {
        selectedAccounts.add(id);
    }
    updateBulkBar();
    renderAccountsTable();
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

// Render expiring cards
function renderExpiringCards() {
    const grid = document.getElementById('expiringGrid');
    const settings = getNotificationSettings();
    const expiring = getExpiringAccounts(settings);
    
    if (expiring.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success);"></i>
                <h3>All Clear!</h3>
                <p>No accounts are expiring within the selected timeframe.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = expiring.map(account => {
        const days = account.daysUntilExpiry;
        const status = account.status;
        const daysClass = status === 'expired' ? 'danger' :
                         status === 'today' ? 'danger' :
                         days <= 3 ? 'danger' :
                         days <= 7 ? 'warning' : 'ok';
        
        return `
            <div class="expiring-card">
                <div class="card-header">
                    <div>
                        <div class="card-email">${escapeHtml(account.email)}</div>
                        <div class="card-client">${escapeHtml(account.client)}</div>
                    </div>
                    <div class="card-days ${daysClass}">
                        ${status === 'expired' ? '💀' : 
                          status === 'today' ? '🔥' : 
                          `${days}d`}
                    </div>
                </div>
                <div class="card-body">
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        ${status === 'expired' ? 'Expired' :
                          status === 'today' ? 'Expires TODAY' :
                          `Expires in ${days} day${days > 1 ? 's' : ''}`}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        Replacement: ${account.replacementEmail ? escapeHtml(account.replacementEmail) : 'Not set'}
                    </div>
                </div>
                <div class="card-footer">
                    <span class="status-badge ${status}">${status}</span>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-ghost" onclick="editAccount('${account.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-ghost" onclick="copyToClipboard('${escapeHtml(account.email)}')">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Render problem accounts
function renderProblemAccounts() {
    const grid = document.getElementById('problemsGrid');
    const problems = window.accounts.filter(a => a.hasProblem);
    
    if (problems.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success);"></i>
                <h3>No Problems!</h3>
                <p>All accounts are in good standing.</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = problems.map(account => `
        <div class="expiring-card problem-card">
            <div class="card-header">
                <div>
                    <div class="card-email">${escapeHtml(account.email)}</div>
                    <div class="card-client">${escapeHtml(account.client)}</div>
                </div>
                <span class="status-badge problem">Problem</span>
            </div>
            <div class="card-body">
                <div style="font-size: 13px; color: var(--text-secondary);">
                    <strong>Note:</strong> ${escapeHtml(account.problemNote || 'No details provided')}
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
                    Expires: ${formatDateDisplay(account.date)}
                </div>
            </div>
            <div class="card-footer">
                <div class="action-buttons">
                    <button class="btn btn-sm btn-success" onclick="resolveProblem('${account.id}')">
                        <i class="fas fa-check"></i> Resolve
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="editAccount('${account.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Resolve problem
async function resolveProblem(id) {
    const account = window.accounts.find(a => a.id === id);
    if (!account) return;
    
    try {
        account.hasProblem = false;
        account.problemNote = '';
        await updateAccount(id, account);
        showToast('Problem resolved!', 'success');
        renderProblemAccounts();
        renderDashboard();
        renderAccountsTable();
    } catch (error) {
        showToast('Error resolving problem', 'error');
    }
}

// Edit account modal
function editAccount(id) {
    const account = window.accounts.find(a => a.id === id);
    if (!account) return;
    
    document.getElementById('accountModalTitle').textContent = 'Edit Account';
    document.getElementById('formClient').value = account.client;
    document.getElementById('formEmail').value = account.email;
    document.getElementById('formDay').value = extractDay(account.date) || '';
    document.getElementById('formReplacement').value = account.replacementEmail || '';
    document.getElementById('formNotes').value = account.problemNote || '';
    document.getElementById('formHasProblem').checked = account.hasProblem;
    
    // Store ID for update
    document.getElementById('accountForm').dataset.editId = id;
    document.getElementById('modalSave').textContent = 'Update Account';
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
window.toggleAccountSelect = toggleAccountSelect;
window.editAccount = editAccount;
window.deleteAccountConfirm = deleteAccountConfirm;
window.resolveProblem = resolveProblem;