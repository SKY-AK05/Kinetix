# Kinetix Quick Start 🚀

## What I Just Set Up For You

Your Kinetix app is now configured for a **split deployment**:

- ✅ **Frontend (PWA)** → Deploy to Vercel
- ✅ **Backend (API + yt-dlp)** → Deploy to Render
- ✅ **Smart Connection Handler** → Handles backend cold starts automatically
- ✅ **User-Friendly Queue System** → Shows "Backend is waking up..." during cold starts

---

## Deploy in 2 Steps

### Step 1: Deploy Backend to Render (5 min)
1. Go to https://render.com → Sign in with GitHub
2. Click "New +" → "Web Service"
3. Connect repo: `SKY-AK05/Kinetix`
4. Click "Apply" (it auto-detects `render.yaml`)
5. **Copy your backend URL** (e.g., `https://kinetix-backend.onrender.com`)

### Step 2: Deploy Frontend to Vercel (3 min)
1. Go to https://vercel.com → Sign in with GitHub
2. Import repo: `SKY-AK05/Kinetix`
3. Add environment variable:
   ```
   KX_API_BASE = https://kinetix-backend.onrender.com
   ```
   (Use YOUR actual Render URL!)
4. Click "Deploy"

**Done!** 🎉

---

## How Cold Start Handling Works

When a user visits your app after 15+ minutes of inactivity:

1. Frontend tries to connect to backend
2. Detects cold start (timeout/error)
3. Shows message: **"Backend is waking up... This may take up to 60s"**
4. Retries every 5 seconds with progress bar
5. Once ready: **"Connected! Backend is ready."**
6. User can now download videos normally

This happens **automatically** - no manual intervention needed!

---

## What Happens Next

### First User Experience
- ⏱️ **Cold start**: 30-60 seconds (Render free tier)
- ✅ **After warm-up**: Instant responses
- 💤 **Idle 15+ min**: Render spins down → next user sees cold start again

### To Avoid Cold Starts
Upgrade to Render's **Starter plan ($7/month)** for always-on backend.

---

## Testing Your Deployment

1. Visit your Vercel URL
2. You'll see "Backend is waking up..." (first time only)
3. After ~30-60s, it says "Connected!"
4. Paste a YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
5. Click "Get Video" → Select quality → Download

---

## Files I Created/Modified

| File | Purpose |
|------|---------|
| `public/config.js` | Added backend status tracking |
| `public/backend-handler.js` | **NEW** - Handles connection, retries, cold starts |
| `render.yaml` | Backend deployment config for Render |
| `DEPLOYMENT.md` | Full deployment guide with troubleshooting |

---

## Need Help?

📖 **Full Guide**: See `DEPLOYMENT.md`  
🔧 **Troubleshooting**: Check Render/Vercel logs  
💬 **Issues**: Open a GitHub issue

---

**Ready to deploy?** Start with Step 1 above! 🚀
