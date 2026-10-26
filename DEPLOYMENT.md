# Kinetix Deployment Guide

This guide will help you deploy Kinetix with the **frontend on Vercel** and **backend on Render**.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Vercel        │         │   Render.com     │
│  (Frontend)     │────────▶│   (Backend)      │
│  Static PWA     │   API   │  Node + yt-dlp   │
└─────────────────┘         └──────────────────┘
```

## Step 1: Deploy Backend to Render (5 minutes)

### 1.1 Sign up / Login to Render
- Go to https://render.com
- Sign in with your GitHub account

### 1.2 Deploy from GitHub
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `SKY-AK05/Kinetix`
3. Render will automatically detect `render.yaml`
4. Click **"Apply"** to start deployment

### 1.3 Configure Environment Variables
Render will automatically set most variables from `render.yaml`. You just need to verify:

- `TOKEN_SECRET`: ✅ Auto-generated
- `CORS_ORIGIN`: Set to `*` (allows all origins) or your Vercel URL
- `FILE_RETENTION_SECONDS`: `900` (15 minutes)
- `MAX_CONCURRENT`: `2` (max concurrent downloads)

### 1.4 Wait for Deployment
- First deployment takes ~5-10 minutes
- You'll get a URL like: `https://kinetix-backend.onrender.com`
- **Copy this URL** - you'll need it for Vercel!

### 1.5 Important: Free Tier Cold Starts
⚠️ **Render's free tier spins down after 15 minutes of inactivity**
- Cold starts take 30-60 seconds to wake up
- The frontend automatically handles this with retry logic
- Users will see a "Backend is waking up..." message

---

## Step 2: Deploy Frontend to Vercel (3 minutes)

### 2.1 Sign up / Login to Vercel
- Go to https://vercel.com
- Sign in with your GitHub account

### 2.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Import your GitHub repo: `SKY-AK05/Kinetix`
3. Vercel will detect the project settings automatically

### 2.3 Configure Environment Variables
**CRITICAL:** Add this environment variable:

```
Key: KX_API_BASE
Value: https://kinetix-backend.onrender.com
```

Replace `https://kinetix-backend.onrender.com` with YOUR actual Render backend URL.

### 2.4 Deploy Settings
- Framework Preset: **Other**
- Build Command: `node scripts/gen-config.js`
- Output Directory: `public`
- Install Command: `echo skip`

Click **"Deploy"**!

### 2.5 Update Render CORS (Important!)
After Vercel deployment, you'll get a URL like: `https://kinetix.vercel.app`

Go back to Render and update the `CORS_ORIGIN` environment variable:
```
CORS_ORIGIN=https://kinetix.vercel.app
```

Then click **"Manual Deploy"** → **"Deploy latest commit"**

---

## Step 3: Test Your Deployment

### 3.1 Visit Your Vercel URL
Open `https://your-app.vercel.app`

### 3.2 First Load Experience
You'll see a status message:
- **First time (cold start)**: "Backend is waking up... This may take up to 60s"
- **After warm-up**: "Connected! Backend is ready."

### 3.3 Test Video Download
1. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
2. Click "Get Video"
3. Select quality and click "Start Download"
4. Video should process and download!

---

## Troubleshooting

### Frontend shows "Could not reach the Kinetix server"

**Check these:**
1. Is your Render backend running? Check https://dashboard.render.com
2. Did you set `KX_API_BASE` in Vercel environment variables?
3. After changing env vars, did you redeploy Vercel?

**How to fix:**
```bash
# In Vercel dashboard:
# Settings → Environment Variables → Add:
KX_API_BASE = https://kinetix-backend.onrender.com

# Then: Deployments → Click "..." → Redeploy
```

### Backend takes forever to wake up

This is normal for Render's free tier (cold starts). The frontend automatically:
- Shows a loading message
- Retries every 5 seconds for up to 60 seconds
- Shows progress bar

**To avoid cold starts:** Upgrade to Render's paid tier ($7/month) for always-on instances.

### CORS errors in browser console

Fix: Update `CORS_ORIGIN` on Render to match your Vercel URL:
```
CORS_ORIGIN=https://your-app.vercel.app
```

---

## Monitoring & Logs

### View Backend Logs (Render)
1. Go to https://dashboard.render.com
2. Click on your `kinetix-backend` service
3. Click "Logs" tab

### View Frontend Logs (Vercel)
1. Go to https://vercel.com/dashboard
2. Click on your project
3. Click "Functions" → View logs

---

## Updating Your Deployment

### Update Backend
```bash
git add .
git commit -m "Update backend"
git push origin main
```
Render auto-deploys on push!

### Update Frontend
```bash
git add .
git commit -m "Update frontend"
git push origin main
```
Vercel auto-deploys on push!

---

## Environment Variables Reference

### Vercel (Frontend)
| Variable | Value | Required |
|----------|-------|----------|
| `KX_API_BASE` | Your Render backend URL | ✅ Yes |

### Render (Backend)
| Variable | Value | Required |
|----------|-------|----------|
| `TOKEN_SECRET` | Auto-generated | ✅ Yes |
| `CORS_ORIGIN` | Your Vercel URL or `*` | ✅ Yes |
| `FILE_RETENTION_SECONDS` | `900` | No (default: 900) |
| `MAX_CONCURRENT` | `2` | No (default: 2) |
| `PORT` | `3000` | No (default: 3000) |

---

## Cost Breakdown

### Free Tier
- **Vercel**: Free (100GB bandwidth/month)
- **Render**: Free (750 hours/month)
- **Total**: $0/month

### Paid Tier (Recommended for production)
- **Vercel**: Free (hobby tier is fine)
- **Render**: $7/month (Starter plan - no cold starts)
- **Total**: $7/month

---

## Quick Links

- 📊 Render Dashboard: https://dashboard.render.com
- 🚀 Vercel Dashboard: https://vercel.com/dashboard
- 📖 Render Docs: https://render.com/docs
- 📖 Vercel Docs: https://vercel.com/docs

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. View logs on Render/Vercel dashboards
3. Open an issue on GitHub

Happy deploying! 🎉
