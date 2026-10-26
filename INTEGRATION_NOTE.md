# Integration Note

## Important: Add backend-handler.js to your HTML

To enable the cold start handling, you need to include the `backend-handler.js` script in your `public/index.html`.

### Add this line in the `<head>` section (after loading config.js):

```html
<script src="/config.js"></script>
<script src="/backend-handler.js"></script>
```

### Then update your existing API calls to use BackendHandler:

**Before:**
```javascript
const response = await fetch(`${window.KX_API_BASE}/api/info?url=${url}`);
```

**After:**
```javascript
const response = await window.BackendHandler.apiCall(`/api/info?url=${url}`);
```

This ensures:
- ✅ Backend health check before API calls
- ✅ Automatic retry on cold starts
- ✅ User-friendly loading messages
- ✅ Progress indicators

## Example API Call Pattern

```javascript
try {
  // BackendHandler automatically checks health and retries if needed
  const response = await window.BackendHandler.apiCall('/api/info?url=' + encodeURIComponent(url));
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  const data = await response.json();
  // Use data...
} catch (error) {
  console.error('API call failed:', error.message);
  // Show error to user
}
```

The `BackendHandler.apiCall()` method:
1. Checks if backend is ready
2. If not ready, runs health check with retry logic
3. Shows "Backend is waking up..." message to user
4. Retries until backend is ready (up to 60 seconds)
5. Once ready, makes the actual API call
6. Returns the fetch response

---

## Manual Testing (Optional)

You can also manually trigger a health check:

```javascript
// In browser console:
await window.BackendHandler.checkHealth();
```

This is useful for debugging connection issues.
