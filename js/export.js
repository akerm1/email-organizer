// ============================================
// EXPORT FUNCTIONS
// ============================================

// Export to CSV
function exportToCSV(accounts = null) {
    const data = accounts || window.accounts;
    if (data.length === 0) {
        showToast('No accounts to export', 'error');
        return;
    }
    
    const headers = ['Client', 'Email', 'Expiry Day', 'Replacement Email', 'Status', 'Days Left', 'Problem Note'];
    const rows = data.map(a => {
        const days = getDaysUntilExpiry(a.date);
        const status = a.hasProblem ? 'Problem' :
                      days < 0 ? 'Expired' :
                      days <= 7 ? 'Expiring' : 'OK';
        return [
            `"${a.client}"`,
            `"${a.email}"`,
            `"${formatDateDisplay(a.date)}"`,
            `"${a.replacementEmail || ''}"`,
            `"${status}"`,
            days !== null ? days : '',
            `"${a.problemNote || ''}"`
        ];
    });
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csv, `email-accounts-${getTodayKey()}.csv`, 'text/csv');
    showToast(`Exported ${data.length} accounts to CSV`, 'success');
}

// Export to Excel (XLS)
function exportToExcel(accounts = null) {
    const data = accounts || window.accounts;
    if (data.length === 0) {
        showToast('No accounts to export', 'error');
        return;
    }
    
    const xml = `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" 
              xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="Email Accounts">
            <Table>
                <Row>
                    ${['Client','Email','Expiry Day','Replacement Email','Status','Days Left','Problem Note']
                        .map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
                </Row>
                ${data.map(a => {
                    const days = getDaysUntilExpiry(a.date);
                    const status = a.hasProblem ? 'Problem' :
                                  days < 0 ? 'Expired' :
                                  days <= 7 ? 'Expiring' : 'OK';
                    return `<Row>
                        <Cell><Data ss:Type="String">${a.client}</Data></Cell>
                        <Cell><Data ss:Type="String">${a.email}</Data></Cell>
                        <Cell><Data ss:Type="String">${formatDateDisplay(a.date)}</Data></Cell>
                        <Cell><Data ss:Type="String">${a.replacementEmail || ''}</Data></Cell>
                        <Cell><Data ss:Type="String">${status}</Data></Cell>
                        <Cell><Data ss:Type="Number">${days !== null ? days : ''}</Data></Cell>
                        <Cell><Data ss:Type="String">${a.problemNote || ''}</Data></Cell>
                    </Row>`;
                }).join('')}
            </Table>
        </Worksheet>
    </Workbook>`;
    
    downloadFile(xml, `email-accounts-${getTodayKey()}.xls`, 'application/vnd.ms-excel');
    showToast(`Exported ${data.length} accounts to Excel`, 'success');
}

// Export to JSON
function exportToJSON(accounts = null) {
    const data = accounts || window.accounts;
    if (data.length === 0) {
        showToast('No accounts to export', 'error');
        return;
    }
    
    const json = JSON.stringify(data.map(a => ({
        client: a.client,
        email: a.email,
        expiryDay: extractDay(a.date),
        replacementEmail: a.replacementEmail || '',
        hasProblem: a.hasProblem,
        problemNote: a.problemNote || '',
        daysUntilExpiry: getDaysUntilExpiry(a.date)
    })), null, 2);
    
    downloadFile(json, `email-accounts-${getTodayKey()}.json`, 'application/json');
    showToast(`Exported ${data.length} accounts to JSON`, 'success');
}

// Download file
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export
window.exportToCSV = exportToCSV;
window.exportToExcel = exportToExcel;
window.exportToJSON = exportToJSON;