// Offline sync and cache manager for Splitwise Clone

const QUEUE_KEY = 'splitwise_offline_queue';
const CACHE_PREFIX = 'splitwise_cache_';

export const syncManager = {
  // Check if we are offline
  isOffline() {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  },

  // Get current offline queue
  getQueue() {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      return q ? JSON.parse(q) : [];
    } catch (err) {
      console.error('Error reading offline queue:', err);
      return [];
    }
  },

  // Add a request to the queue
  addToQueue(url, method, body) {
    const queue = this.getQueue();
    const newItem = {
      id: `offline_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      method,
      body,
      timestamp: new Date().toISOString()
    };
    queue.push(newItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Notify the application that queue length has changed
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { 
      detail: { count: queue.length } 
    }));

    return newItem.id;
  },

  // Remove a request from the queue by ID
  removeFromQueue(id) {
    let queue = this.getQueue();
    queue = queue.filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { 
      detail: { count: queue.length } 
    }));
  },

  // Clear entire queue
  clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { 
      detail: { count: 0 } 
    }));
  },

  // Cache handling (scoped by currentUser if logged in)
  getCacheKey(url) {
    let userId = 'anonymous';
    try {
      const userStr = localStorage.getItem('splitwise_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u && u.id) userId = u.id;
      }
    } catch {}
    // Replace slashes/query parameters to make a safe key name
    const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_');
    return `${CACHE_PREFIX}${userId}_${sanitizedUrl}`;
  },

  setCachedData(url, data) {
    try {
      const key = this.getCacheKey(url);
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Failed to set cache:', err);
    }
  },

  getCachedData(url) {
    try {
      const key = this.getCacheKey(url);
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // We can check age here if we want, but for offline mode, serving stale cache is perfect
        return parsed.data;
      }
    } catch (err) {
      console.error('Failed to get cache:', err);
    }
    return null;
  },

  // Process the queue when back online
  async processQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    window.dispatchEvent(new CustomEvent('sync-status-changed', { 
      detail: { status: 'syncing', count: queue.length } 
    }));

    const token = localStorage.getItem('splitwise_token');
    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (response.ok) {
          this.removeFromQueue(item.id);
          successCount++;
        } else {
          // If it's a validation error or item already deleted, discard it to avoid deadlock
          if (response.status === 400 || response.status === 404 || response.status === 422) {
            console.warn(`Discarding invalid queued request (${item.url}, status ${response.status}):`, item);
            this.removeFromQueue(item.id);
          } else {
            // Keep in queue for next retry if server error / network error
            failCount++;
          }
        }
      } catch (err) {
        console.error(`Failed to process queued request ${item.url}:`, err);
        failCount++;
        // If we failed due to fetch error, network might be down again, so break
        break;
      }
    }

    if (successCount > 0 && failCount === 0) {
      window.dispatchEvent(new CustomEvent('sync-status-changed', { 
        detail: { status: 'success', count: 0 } 
      }));
      // Dispatch sync-completed to let views refresh their data
      window.dispatchEvent(new CustomEvent('sync-completed'));
    } else if (failCount > 0) {
      const remaining = this.getQueue().length;
      window.dispatchEvent(new CustomEvent('sync-status-changed', { 
        detail: { status: 'failed', count: remaining } 
      }));
    }
  }
};

// Set up online listener to auto-sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('App is back online! Processing sync queue...');
    syncManager.processQueue();
  });
}
