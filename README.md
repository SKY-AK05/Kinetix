# Kinetix

Share a video link from YouTube to Kinetix and get a high-quality MP4 saved on your device.
Neo-brutalist PWA front-end + yt-dlp/ffmpeg backend.

```
public/     static PWA (deploy to Vercel)
server.js   API + download worker (deploy with Docker: Render / Railway / Fly.io / VPS)
```

> Vercel serverless functions cannot run yt-dlp/ffmpeg or keep long jobs and temp files,
> so the app is a **split deploy**: front-end on Vercel, backend on any Docker host.

## 1. Deploy the backend (Docker)
**Render:** New → Blueprint → select this repo (uses `render.yaml`). Set `CORS_ORIGIN` to your Vercel URL.
**Railway/Fly/VPS:** build the `Dockerfile`, expose port 3000, and set the env vars from `.env.example`.
Check `https://YOUR-BACKEND/healthz` returns `ok`.

## 2. Deploy the front-end (Vercel)
1. Import the GitHub repo in Vercel (no framework preset needed; `vercel.json` handles it).
2. Add env var **`KX_API_BASE`** = your backend URL (no trailing slash), e.g. `https://kinetix-api.onrender.com`.
3. Deploy. Then set the backend's `CORS_ORIGIN` to the Vercel URL and redeploy the backend.

## 3. Use it on Android
Open the Vercel URL in Chrome → *Install app*. In YouTube: **Share → Kinetix**.
iOS has no Web Share Target for PWAs; use Paste, or a Shortcut that opens `https://YOUR-APP.vercel.app/?url=<link>`.

## Run locally
```
npm install && npm start      # needs node 18+, ffmpeg, yt-dlp on PATH
# open http://localhost:3000   (frontend + API on one origin, KX_API_BASE empty)
```

## Notes
- Creative Commons videos download directly; anything else requires the user to confirm they own it or have permission.
- Cloud/datacenter IPs are often challenged by YouTube ("confirm you're not a bot"). If downloads fail
  from a hosted backend, run the backend on a home server/VPS you trust and keep yt-dlp updated (`yt-dlp -U`).
- Env: `TOKEN_SECRET`, `CORS_ORIGIN`, `FILE_RETENTION_SECONDS`, `MAX_CONCURRENT`, `COMPAT_TRANSCODE=1` (re-encode VP9/AV1 to H.264).
