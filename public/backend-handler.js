/**
 * Backend connection handler for Kinetix
 * Manages cold starts, health checks, and graceful queuing
 */

const BackendHandler = {
  baseURL: '',
  isReady: false,
  isColdStart: false,
  checkInProgress: false,

  init() {
    this.baseURL = window.KX_API_BASE || '';
    this.checkHealth();
  },

  async checkHealth(showUI = true) {
    if (this.checkInProgress) return this.isReady;
    
    this.checkInProgress = true;
    const status = window.KX_BACKEND_STATUS;

    if (showUI) {
      this.showBackendStatus('checking', 'Connecting to Kinetix backend...');
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.baseURL}/healthz`, {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeout);

      if (response.ok) {
        this.isReady = true;
        status.isReady = true;
        status.retryAttempts = 0;
        
        if (showUI) {
          this.showBackendStatus('ready', 'Connected! Backend is ready.');
          setTimeout(() => this.hideBackendStatus(), 2000);
        }
        
        this.checkInProgress = false;
        return true;
      }
    } catch (error) {
      console.warn('Backend health check failed:', error.message);
      
      // Backend might be cold starting on Render free tier
      if (status.retryAttempts === 0) {
        this.isColdStart = true;
        status.isColdStart = true;
      }

      status.retryAttempts++;

      // Show appropriate message
      if (this.isColdStart && status.retryAttempts < status.maxRetries) {
        const eta = Math.ceil((status.maxRetries - status.retryAttempts) * status.retryDelay / 1000);
        if (showUI) {
          this.showBackendStatus(
            'cold-start',
            `Backend is waking up (free tier cold start)... This may take up to ${eta}s. Please wait.`,
            status.retryAttempts,
            status.maxRetries
          );
        }
        
        // Retry after delay
        this.checkInProgress = false;
        setTimeout(() => this.checkHealth(showUI), status.retryDelay);
        return false;
      } else if (status.retryAttempts >= status.maxRetries) {
        if (showUI) {
          this.showBackendStatus(
            'error',
            'Backend is not responding. Please try again in a few minutes or check your connection.'
          );
        }
        this.checkInProgress = false;
        return false;
      }
    }

    this.checkInProgress = false;
    return this.isReady;
  },

  showBackendStatus(type, message, current = 0, total = 0) {
    let statusBox = document.getElementById('backendStatusBox');
    
    if (!statusBox) {
      // Create status box if it doesn't exist
      statusBox = document.createElement('div');
      statusBox.id = 'backendStatusBox';
      statusBox.className = 'fixed bottom-6 right-6 max-w-md z-50 transform transition-all duration-300';
      document.body.appendChild(statusBox);
    }

    const icons = {
      checking: '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>',
      'cold-start': '<svg class="w-5 h-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
      ready: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>',
      error: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };

    const colors = {
      checking: 'bg-blue-500',
      'cold-start': 'bg-amber-500',
      ready: 'bg-green-500',
      error: 'bg-red-500'
    };

    const progressBar = (type === 'cold-start' && total > 0) 
      ? `<div class="mt-2 h-1.5 bg-black/20 overflow-hidden"><div class="h-full bg-white transition-all duration-500" style="width: ${(current / total) * 100}%"></div></div>`
      : '';

    statusBox.innerHTML = `
      <div class="${colors[type]} text-white px-4 py-3 shadow-lg border-2 border-black" style="box-shadow: 4px 4px 0 #0A0A0A">
        <div class="flex items-start gap-3">
          <div class="shrink-0 mt-0.5">${icons[type]}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold leading-snug">${message}</p>
            ${progressBar}
          </div>
        </div>
      </div>
    `;

    statusBox.style.opacity = '0';
    statusBox.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      statusBox.style.opacity = '1';
      statusBox.style.transform = 'translateY(0)';
    }, 10);
  },

  hideBackendStatus() {
    const statusBox = document.getElementById('backendStatusBox');
    if (statusBox) {
      statusBox.style.opacity = '0';
      statusBox.style.transform = 'translateY(20px)';
      setTimeout(() => statusBox.remove(), 300);
    }
  },

  async apiCall(endpoint, options = {}) {
    // Ensure backend is ready before making API calls
    if (!this.isReady) {
      const ready = await this.checkHealth(true);
      if (!ready) {
        throw new Error('Backend is not available. Please try again later.');
      }
    }

    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, options);
    
    if (!response.ok && response.status >= 500) {
      // Server error - backend might have gone down
      this.isReady = false;
      throw new Error('Backend server error. Please try again.');
    }

    return response;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BackendHandler.init());
} else {
  BackendHandler.init();
}

// Export for use in other scripts
window.BackendHandler = BackendHandler;
