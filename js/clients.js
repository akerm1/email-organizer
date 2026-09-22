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

// Render the Clients home grid (client boxes with red/orange notification badges)
function renderClientsHome() {
    const grid = document.getElementById('clientsHomeGrid');
    if (!grid) return;

    const summaries = getClientSummaries().sort((a, b) => {
        if (b.expired !== a.expired) return b.expired - a.expired;
        if (b.expiring !== a.expiring) return b.expiring - a.expiring;
        return a.name.localeCompare(b.name);
    });

    if (summaries.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <h3>No clients yet</h3>
                <p>Add your first account or client to get started.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = summaries.map(c => {
        const ref = clientRef(c.name);
        const initials = escapeHtml(clientInitials(c.name));
        const color = clientColor(c.name);
        const problemsTag = c.problems > 0
            ? `<span class="mini-badge problem">${c.problems} problem${c.problems > 1 ? 's' : ''}</span>`
            : '';
        return `
            <div class="client-card home-client-card" onclick="viewClient('${ref}')" role="button" tabindex="0"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewClient('${ref}')}">
                <div class="client-card-top">
                    <div class="client-avatar" style="background:${color};">${initials}</div>
                    <div class="client-card-info">
                        <h4>${escapeHtml(c.name)}</h4>
                        <span>${c.total} email${c.total === 1 ? '' : 's'}</span>
                        <span class="badge-row">${problemsTag}</span>
                    </div>
                    <div class="notif-badges">
                        ${c.expired > 0 ? `<span class="notif-badge red" title="Expired accounts">${c.expired}</span>` : ''}
                        ${c.expiring > 0 ? `<span class="notif-badge orange" title="Expiring accounts">${c.expiring}</span>` : ''}
                    </div>
                </div>
                <div class="client-stats">
                    <span class="client-stat ok"><i class="fas fa-check-circle"></i> ${c.ok} OK</span>
                    <span class="client-stat warning"><i class="fas fa-clock"></i> ${c.expiring} expiring</span>
                    <span class="client-stat danger"><i class="fas fa-times-circle"></i> ${c.expired} expired</span>
                </div>
                <div class="client-card-actions">
                    <button type="button" class="btn btn-sm btn-primary" onclick="event.stopPropagation(); selectAllForClientRef('${ref}')">
                        <i class="fas fa-check-double"></i> Select all
                    </button>
                    <button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); copyClientByRef('${ref}')" title="Copy all emails">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button type="button" class="btn btn-sm btn-ghost" onclick="event.stopPropagation(); viewClient('${ref}')" title="View emails">
                        View <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// CLIENT ACTIONS (used from client detail / home)
// ============================================

// Open a client's email set (ref-safe wrapper)
function viewClient(ref) {
    const name = clientNameFromRef(ref);
    if (!name) return;
    openClientDetail(name);
}

// Copy all emails for a client (ref-safe)
function copyClientByRef(ref) {
    const name = clientNameFromRef(ref);
    if (!name) return;
    copyClientEmails(name);
}

// Add account for a client
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
        if (activeClient === oldName) activeClient = trimmed;
        refreshAllViews();
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
        window.accounts.filter(a => a.client === name).forEach(a => selectedAccounts.delete(a.id));

        if (activeClient === name) {
            activeClient = '';
            navigateTo('dashboard');
        } else {
            refreshAllViews();
        }
        updateCharts();
        showToast(`Client "${name}" deleted`, 'success');
    } catch (error) {
        showToast('Error deleting client', 'error');
        console.error(error);
    }
}

// Export
window.renderClientsHome = renderClientsHome;
window.viewClient = viewClient;
window.copyClientByRef = copyClientByRef;
window.addAccountForClient = addAccountForClient;
window.copyClientEmails = copyClientEmails;
window.renameClientFlow = renameClientFlow;
window.deleteClientFlow = deleteClientFlow;