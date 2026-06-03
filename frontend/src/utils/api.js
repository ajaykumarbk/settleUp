// API integration client for Splitwise Clone

const API_BASE = ''; // Relying on Vite proxy to map to http://localhost:5000

async function request(url, options = {}) {
  const token = localStorage.getItem('splitwise_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle auto logout on session expiry
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('splitwise_token');
        localStorage.removeItem('splitwise_user');
        // Do not force reload if already on login/signup pages
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
          window.location.href = '/login';
        }
      }
      
      // Handle database offline (Service Unavailable)
      if (response.status === 503) {
        return {
          error: true,
          status: 503,
          message: data.message || 'Database connection offline',
          troubleshooting: data.troubleshooting,
          details: data.error
        };
      }

      return {
        error: true,
        status: response.status,
        message: data.message || 'An error occurred during request'
      };
    }

    return data;
  } catch (err) {
    console.error(`API Fetch Error (${url}):`, err);
    return {
      error: true,
      message: 'Failed to connect to backend server. Make sure node backend is running.'
    };
  }
}

export const api = {
  // Authentication
  auth: {
    login: async (emailOrUsername, password) => {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername, password })
      });
      if (data && data.token) {
        localStorage.setItem('splitwise_token', data.token);
        localStorage.setItem('splitwise_user', JSON.stringify(data.user));
      }
      return data;
    },
    signup: async (username, email, password) => {
      const data = await request('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      if (data && data.token) {
        localStorage.setItem('splitwise_token', data.token);
        localStorage.setItem('splitwise_user', JSON.stringify(data.user));
      }
      return data;
    },
    me: async () => {
      return await request('/api/auth/me');
    },
    logout: () => {
      localStorage.removeItem('splitwise_token');
      localStorage.removeItem('splitwise_user');
      window.location.href = '/login';
    },
    getUser: () => {
      try {
        const u = localStorage.getItem('splitwise_user');
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    },
    exportData: async () => {
      const token = localStorage.getItem('splitwise_token');
      try {
        const res = await fetch('/api/auth/export', {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok) throw new Error('Backup failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const u = api.auth.getUser();
        a.download = `splitwise_backup_${u ? u.username : 'data'}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return { success: true };
      } catch (err) {
        console.error('Backup download error:', err);
        return { error: true, message: 'Backup download failed.' };
      }
    }
  },

  // Friends
  friends: {
    list: async () => request('/api/friends'),
    add: async (emailOrUsername) => request('/api/friends/add', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername })
    }),
    balances: async () => request('/api/friends/balances')
  },

  // Groups
  groups: {
    list: async () => request('/api/groups'),
    create: async (name, description, memberEmails) => request('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, memberEmails })
    }),
    getDetails: async (id) => request(`/api/groups/${id}`),
    addMember: async (id, email) => request(`/api/groups/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
    updateDefaultSplit: async (id, defaultSplitType, defaultSplitShares) => request(`/api/groups/${id}/default-split`, {
      method: 'PUT',
      body: JSON.stringify({ defaultSplitType, defaultSplitShares })
    })
  },

  // Expenses
  expenses: {
    list: async (filters = {}) => {
      let query = '';
      if (filters.groupId) query = `?groupId=${filters.groupId}`;
      else if (filters.friendId) query = `?friendId=${filters.friendId}`;
      return request(`/api/expenses${query}`);
    },
    create: async (expenseData) => request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseData)
    }),
    delete: async (id) => request(`/api/expenses/${id}`, {
      method: 'DELETE'
    }),
    uploadReceipt: async (file) => {
      const formData = new FormData();
      formData.append('receipt', file);
      const token = localStorage.getItem('splitwise_token');
      try {
        const res = await fetch('/api/expenses/upload-receipt', {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: formData
        });
        if (!res.ok) throw new Error('File upload error');
        return await res.json();
      } catch (err) {
        console.error('Receipt Upload API Error:', err);
        return { error: true, message: 'Receipt upload failed.' };
      }
    }
  },

  // Settlements
  settlements: {
    list: async (filters = {}) => {
      let query = '';
      if (filters.groupId) query = `?groupId=${filters.groupId}`;
      else if (filters.friendId) query = `?friendId=${filters.friendId}`;
      return request(`/api/settlements${query}`);
    },
    create: async (settleData) => request('/api/settlements', {
      method: 'POST',
      body: JSON.stringify(settleData)
    })
  },

  // System Status
  status: {
    check: async () => request('/api/status')
  }
};
