// ============================================
// ANALYTICS & CHARTS
// ============================================

let charts = {};

// Initialize all charts
function initCharts() {
    createExpiryChart();
    createHealthChart();
    createTrendChart();
    createClientChart();
    createStatusChart();
    createProblemChart();
}

// Create expiry distribution chart
function createExpiryChart() {
    const ctx = document.getElementById('expiryChart');
    if (!ctx) return;
    
    const data = {
        expired: 0,
        today: 0,
        week: 0,
        month: 0,
        future: 0
    };
    
    window.accounts.forEach(a => {
        const days = getDaysUntilExpiry(a.date);
        if (days === null) return;
        if (days < 0) data.expired++;
        else if (days === 0) data.today++;
        else if (days <= 7) data.week++;
        else if (days <= 30) data.month++;
        else data.future++;
    });
    
    charts.expiry = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Expired', 'Today', 'This Week', 'This Month', 'Future'],
            datasets: [{
                data: [data.expired, data.today, data.week, data.month, data.future],
                backgroundColor: [
                    '#ef4444', '#f59e0b', '#f97316', '#6366f1', '#10b981'
                ],
                borderWidth: 2,
                borderColor: 'var(--bg-secondary)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Create health chart
function createHealthChart() {
    const ctx = document.getElementById('healthChart');
    if (!ctx) return;
    
    const healthy = window.accounts.filter(a => !a.hasProblem).length;
    const problems = window.accounts.filter(a => a.hasProblem).length;
    
    charts.health = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Healthy', 'Problems'],
            datasets: [{
                data: [healthy, problems],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 2,
                borderColor: 'var(--bg-secondary)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Create trend chart
function createTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    // Generate last 30 days of data
    const labels = [];
    const expiringData = [];
    const expiredData = [];
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        const expiring = window.accounts.filter(a => {
            const days = getDaysUntilExpiry(a.date);
            return days !== null && days <= 30 && days >= 0;
        }).length;
        
        const expired = window.accounts.filter(a => {
            const days = getDaysUntilExpiry(a.date);
            return days !== null && days < 0;
        }).length;
        
        expiringData.push(expiring);
        expiredData.push(expired);
    }
    
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Expiring Soon',
                    data: expiringData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Expired',
                    data: expiredData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Create client distribution chart
function createClientChart() {
    const ctx = document.getElementById('clientChart');
    if (!ctx) return;
    
    const clientData = {};
    window.accounts.forEach(a => {
        clientData[a.client] = (clientData[a.client] || 0) + 1;
    });
    
    const sorted = Object.entries(clientData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const colors = [
        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
        '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#10b981'
    ];
    
    charts.client = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                label: 'Accounts',
                data: sorted.map(([, count]) => count),
                backgroundColor: colors.slice(0, sorted.length),
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Create status breakdown chart
function createStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    const status = {
        ok: 0,
        expiring: 0,
        expired: 0,
        problem: 0
    };
    
    window.accounts.forEach(a => {
        if (a.hasProblem) {
            status.problem++;
        } else {
            const days = getDaysUntilExpiry(a.date);
            if (days === null) return;
            if (days < 0) status.expired++;
            else if (days <= 7) status.expiring++;
            else status.ok++;
        }
    });
    
    charts.status = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: ['OK', 'Expiring', 'Expired', 'Problem'],
            datasets: [{
                data: [status.ok, status.expiring, status.expired, status.problem],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
                borderWidth: 2,
                borderColor: 'var(--bg-secondary)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            }
        }
    });
}

// Create problem types chart
function createProblemChart() {
    const ctx = document.getElementById('problemChart');
    if (!ctx) return;
    
    const problemNotes = {};
    window.accounts
        .filter(a => a.hasProblem && a.problemNote)
        .forEach(a => {
            const note = a.problemNote.toLowerCase();
            const type = note.includes('expired') || note.includes('past due') ? 'Expired Issues' :
                        note.includes('invalid') || note.includes('bounce') ? 'Delivery Issues' :
                        note.includes('password') || note.includes('access') ? 'Access Issues' :
                        'Other Problems';
            problemNotes[type] = (problemNotes[type] || 0) + 1;
        });
    
    if (Object.keys(problemNotes).length === 0) {
        charts.problem = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No Problems'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#10b981'],
                    borderWidth: 2,
                    borderColor: 'var(--bg-secondary)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '70%'
            }
        });
        return;
    }
    
    const colors = ['#ef4444', '#f59e0b', '#6366f1', '#8b5cf6'];
    charts.problem = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(problemNotes),
            datasets: [{
                data: Object.values(problemNotes),
                backgroundColor: colors.slice(0, Object.keys(problemNotes).length),
                borderWidth: 2,
                borderColor: 'var(--bg-secondary)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// Update all charts
function updateCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
        }
    });
    initCharts();
}

// Export
window.initCharts = initCharts;
window.updateCharts = updateCharts;