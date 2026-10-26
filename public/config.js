// Backend API base URL - set via environment variable KX_API_BASE during build
// If empty, defaults to same origin (for single-server deployments)
// For split deployments, set to your backend URL (e.g., https://kinetix-api.onrender.com)
window.KX_API_BASE = "";

// Backend health check and cold start handling
window.KX_BACKEND_STATUS = {
  isReady: false,
  isColdStart: false,
  retryAttempts: 0,
  maxRetries: 12, // 12 retries = ~60 seconds
  retryDelay: 5000 // 5 seconds between retries
};
