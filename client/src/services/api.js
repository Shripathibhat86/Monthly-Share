const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || response.statusText || 'Request failed';
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Members
  getMembers: () => request('/members'),
  updateMember: (id, payload) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateMemberPin: (id, payload) => request(`/members/${id}/pin`, { method: 'PUT', body: JSON.stringify(payload) }),
  verifyPin: (memberId, pin) => request('/members/verify-pin', { method: 'POST', body: JSON.stringify({ memberId, pin }) }),

  // Expenses
  getExpenses: (params = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value);
      }
    }
    const qStr = query.toString();
    return request(`/expenses${qStr ? `?${qStr}` : ''}`);
  },
  getExpense: (id) => request(`/expenses/${id}`),
  getReceiptUrl: (id, download = false) => `${BASE_URL}/expenses/${id}/receipt${download ? '?download=1' : ''}`,
  createExpense: (payload) => request('/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  updateExpense: (id, payload) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteExpense: (id, payload) => request(`/expenses/${id}`, { method: 'DELETE', body: JSON.stringify(payload) }),
  deleteAllExpenses: (payload) => request('/expenses/all', { method: 'DELETE', body: JSON.stringify(payload) }),
  importExpenses: (payload) => request('/expenses/import', { method: 'POST', body: JSON.stringify(payload) }),

  // Settlements
  getSettlementSummary: (month) => request(`/settlements/summary?month=${encodeURIComponent(month)}`),
  completeSettlement: (payload) => request('/settlements/complete', { method: 'POST', body: JSON.stringify(payload) }),
  reverseSettlement: (id, payload) => request(`/settlements/${id}/reverse`, { method: 'POST', body: JSON.stringify(payload) }),

  // Reports
  getMonthlyReport: (month) => request(`/reports/monthly?month=${encodeURIComponent(month)}`),
  getYearlyReport: (year) => request(`/reports/yearly?year=${encodeURIComponent(year)}`),
  getParticipationReport: (month) => request(`/reports/participation${month ? `?month=${encodeURIComponent(month)}` : ''}`),

  // System & Backup
  getSystemInfo: () => request('/system/info'),
  exportBackupUrl: `${BASE_URL}/backup/export`,
  restoreBackup: (payload) => request('/backup/restore', { method: 'POST', body: JSON.stringify(payload) })
};
