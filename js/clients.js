// ============================================
// CLIENTS MANAGEMENT
// ============================================

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#3b82f6'];

function clientInitials(name) {
    const parts = String(name).trim().split(/\s+/);
    return ((parts[0] && parts[0][0]) || '') + ((parts[1] && parts[1][0]) || '');
}

function clientColor(name) {
    let h = 0;
    const s = String(name);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Summaries per client: totals + status breakdown
function getClientSummaries() {
    const names = window.clients || [];
    const byClient = {};
    window.accounts.forEach(a => {
        const key = a.client || 'Unassigned';
        if (!byClient[key]) byClient[key] = { total: 0, ok: 0, expiring: 0, expired: 0, problems: 0 };
        byClient[key].total++;
        if (a.hasProblem) byClient[key].problems++;
        const days = getDaysUntilExpiry(a.date);
        if (days === null) {
            byClient[key].ok++;
        } else if (days < 0) {
            byClient[key].expired++;
        } else if (days <= 7) {
            byClient[key].expiring++;
        } else {
            byClient[key].ok++;
        }
    });
    return names.map(name => ({ name, ...(byClient[name] || { total: 0, ok: 0, expiring: 0, expired: 0, problems: 0 }) }));
}

// Render the clients grid
function renderClients() {
    const grid = document.getElementById('clientsGrid');
    if (!grid) return;

    let summaries = getClientSummaries();

    // Search filter
    const searchEl = document.getElementById('clientSearch');
    const query = (searchEl ? searchEl.value : '').trim().toLowerCase();
    if (query) {
        summaries = summaries.filter(c => c.name.toLowerCase().includes(query));
    }

    if (summaries.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-building"></i>
                <h3>No clients yet</h3>
                <p>Add a client to start organizing your accounts.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = summaries.map(c => {
        const enc = encodeURIComponent(c.name);
        const initials = escapeHtml(clientInitials(c.name));
        const color = clientColor(c.name);
        const problemsTag = c.problems > 0
            ? `<span class="status-badge problem">${c.problems} problem${c.problems > 1 ? 's' : ''}</span>`
            : '';
        return `
            <div class="client-card">
                <div class="client-card-top">
                    <div class="client-avatar" style="background:${color};">${initials}</div>
                    <div class="client-card-info">
                        <h4>${escapeHtml(c.name)}</h4>
                        <span>${c.total} account${c.total === 1 ? '' : 's'}</span>
                    </div>
                    ${problemsTag}
                </div>
                <div class="client-stats">
                    <span class="client-stat ok"><i class="fas fa-check-circle"></i> ${c.ok} OK</span>
                    <span class="client-stat warning"><i class="fas fa-clock"></i> ${c.expiring} expiring</span>
                    <span class="client-stat danger"><i class="fas fa-times-circle"></i> ${c.expired} expired</span>
                </div>
                <div class="client-card-actions">
                    <button class="btn btn-sm btn-primary" onclick="addAccountForClient('${enc}')" title="Add an account for this client">
                        <i class="fas fa-plus"></i> Add
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="copyClientEmails('${enc}')" title="Copy all emails">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="renameClientFlow('${enc}')" title="Rename client">
                        <i class="fas fa-edit"></i> Rename
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteClientFlow('${enc}')" title="Delete client">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Add client inline form
function showAddClientForm() {
    document.getElementById('showAddClientBtn').classList.add('hidden');
    document.getElementById('newClientForm').classList.remove('hidden');
    document.getElementById('newClientName').focus();
}

function hideAddClientForm() {
    document.getElementById('showAddClientBtn').classList.remove('hidden');
    document.getElementById('newClientForm').classList.add('hidden');
    document.getElementById('newClientName').value = '';
}

async function saveNewClient() {
    const name = document.getElementById('newClientName').value.trim();
    if (!name) {
        showToast('Enter a client name', 'error');
        return;
    }
    if ((window.clients || []).includes(name)) {
        showToast('Client already exists', 'error');
        return;
    }
    try {
        await addClient(name);
        lastClientOptionsKey = '';
        populateClientOptionsIfChanged();
        hideAddClientForm();
        renderClients();
        renderDashboard();
        showToast(`Client "${name}" added`, 'success');
    } catch (error) {
        showToast('Error adding client', 'error');
        console.error(error);
    }
}

// Rename a client (also renames all of its accounts)
async function renameClientFlow(oldName) {
    const newName = prompt(`Rename client "${oldName}" to:`, oldName);
    const trimmed = newName ? newName.trim() : '';
    if (!trimmed || trimmed === oldName) return;
    if ((window.clients || []).includes(trimmed)) {
        showToast('Client already exists', 'error');
        return;
    }
    try {
        await renameClient(oldName, trimmed);
        lastClientOptionsKey = '';
        populateClientOptionsIfChanged();
        renderClients();
        renderDashboard();
        renderAccountsTable(getFilteredAccounts());
        updateCharts();
        showToast(`Renamed to "${trimmed}"`, 'success');
    } catch (error) {
        showToast('Error renaming client', 'error');
        console.error(error);
    }
}

// Delete a client (optionally its accounts) after confirmation
async function deleteClientFlow(name) {
    const count = window.accounts.filter(a => a.client === name).length;
    const msg = count > 0
        ? `Delete client "${name}" and ALL ${count} account(s)? This cannot be undone.`
        : `Delete client "${name}"?`;
    if (!confirm(msg)) return;
    try {
        await deleteClient(name, true);
        lastClientOptionsKey = '';
        populateClientOptionsIfChanged();
        const cf = document.getElementById('clientFilter');
        if (cf && cf.value === name) cf.value = 'all';
        renderClients();
        renderDashboard();
        renderAccountsTable(getFilteredAccounts());
        renderExpiringCards();
        renderProblemAccounts();
        updateCharts();
        showToast(`Client "${name}" deleted`, 'success');
    } catch (error) {
        showToast('Error deleting client', 'error');
        console.error(error);
    }
}

// Quick actions
function addAccountForClient(name) {
    openAddAccountModal(name);
}

function copyClientEmails(name) {
    const emails = window.accounts.filter(a => a.client === name).map(a => a.email);
    if (emails.length === 0) {
        showToast('No accounts with emails', 'info');
        return;
    }
    copyToClipboard(emails.join('\n'));
}

// Wire up the inline add form
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showAddClientBtn')?.addEventListener('click', showAddClientForm);
    document.getElementById('saveClientBtn')?.addEventListener('click', saveNewClient);
    document.getElementById('cancelClientBtn')?.addEventListener('click', hideAddClientForm);
    document.getElementById('newClientName')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveNewClient();
    });
});

// Export
window.renderClients = renderClients;
window.addAccountForClient = addAccountForClient;
window.copyClientEmails = copyClientEmails;
window.renameClientFlow = renameClientFlow;
window.deleteClientFlow = deleteClientFlow;