/**
 * Kinetix backend: share-target PWA + yt-dlp/ffmpeg download worker.
 * Requires: node >= 18, yt-dlp, ffmpeg on PATH.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const TMP_DIR = process.env.TMP_DIR || path.join(__dirname, 'tmp');
const RETENTION_MS = (parseInt(process.env.FILE_RETENTION_SECONDS, 10) || 900) * 1000;
const SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
// Set COMPAT_TRANSCODE=1 to convert VP9/AV1 (1440p+) to H.264 so every phone gallery can play it.
const COMPAT_TRANSCODE = process.env.COMPAT_TRANSCODE === '1';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT, 10) || 2;

fs.mkdirSync(TMP_DIR, { recursive: true });

const ALLOWED_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
  'download.blender.org', 'peach.blender.org', 'commons.wikimedia.org', 'upload.wikimedia.org',
  'archive.org', 'media.w3.org', 'vimeo.com'
]);

function parseAllowedUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
  return u.toString();
}

const sign = (id, exp) => crypto.createHmac('sha256', SECRET).update(id + '.' + exp).digest('hex');

// ---------- yt-dlp helpers ----------
function ytdlpJson(url) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', ['-J', '--no-playlist', '--no-warnings', url],
      { maxBuffer: 64 * 1024 * 1024, timeout: 45000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).split('\n').filter(Boolean).pop()));
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
      });
  });
}

const infoCache = new Map(); // url -> {at, data}
async function getInfo(url) {
  const hit = infoCache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
  const j = await ytdlpJson(url);
  const heights = (j.formats || []).filter(f => f.vcodec && f.vcodec !== 'none' && f.height).map(f => f.height);
  const lic = String(j.license || '');
  const data = {
    id: j.id,
    title: j.title,
    uploader: j.uploader || j.channel || '',
    duration: Math.round(j.duration || 0),
    thumbnail: j.thumbnail || '',
    maxHeight: heights.length ? Math.max(...heights) : 0,
    license: lic || null,
    openLicense: /creative commons/i.test(lic),
    platform: j.extractor_key || 'Web'
  };
  infoCache.set(url, { at: Date.now(), data });
  return data;
}

// ---------- jobs ----------
const jobs = new Map();
let running = 0;

function newJob(opts) {
  const id = crypto.randomBytes(8).toString('hex');
  const job = { id, status: 'queued', progress: 0, stage: 'Queued', file: null, filename: null,
                expiresAt: 0, proc: null, error: null, ...opts };
  jobs.set(id, job);
  return job;
}

function runJob(job) {
  running++;
  const dir = path.join(TMP_DIR, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'out.%(ext)s');
  const args = ['--no-playlist', '--no-warnings', '--newline', '--restrict-filenames',
    '--progress-template', 'KX:%(progress._percent_str)s|%(progress._speed_str)s',
    '-o', out];

  if (job.format === 'mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', job.bitrate || '320K', '--embed-metadata');
  } else {
    const h = job.height || 2160;
    // Best video up to the chosen height + best audio, merged into MP4.
    args.push('-f', `bv*[height<=${h}]+ba/b[height<=${h}]`,
      '-S', 'res,vcodec:h264,acodec:aac', '--merge-output-format', 'mp4', '--embed-metadata');
    if (COMPAT_TRANSCODE) {
      args.push('--recode-video', 'mp4', '--postprocessor-args', 'VideoConvertor:-c:v libx264 -crf 18 -c:a aac -movflags +faststart');
    } else {
      args.push('--postprocessor-args', 'Merger:-movflags +faststart');
    }
  }
  args.push(job.url);

  job.status = 'processing';
  job.stage = 'Fetching streams';
  const p = spawn('yt-dlp', args);
  job.proc = p;
  let pass = 0, lastPct = 0, errBuf = '';

  p.stdout.on('data', chunk => {
    for (const line of chunk.toString().split('\n')) {
      if (line.startsWith('KX:')) {
        const pct = parseFloat(line.slice(3));
        if (!isNaN(pct)) {
          if (pct < lastPct - 30) pass++; // video -> audio pass restarts at 0
          lastPct = pct;
          job.progress = Math.min(90, job.format === 'mp4' ? (pass === 0 ? pct * 0.75 : 75 + pct * 0.15) : pct * 0.9);
          job.stage = job.format === 'mp4' ? (pass === 0 ? 'Downloading video' : 'Downloading audio') : 'Downloading audio';
        }
      } else if (/\[Merger\]|\[ExtractAudio\]|\[VideoConvertor\]/.test(line)) {
        job.progress = 93; job.stage = 'Muxing with FFmpeg';
      }
    }
  });
  p.stderr.on('data', d => { errBuf += d.toString(); });
  p.on('close', code => {
    running--;
    job.proc = null;
    if (job.status === 'cancelled') return cleanup(job);
    if (code !== 0) {
      job.status = 'failed';
      job.error = (errBuf.split('\n').filter(Boolean).pop() || 'Download failed').slice(0, 300);
      return cleanup(job);
    }
    const f = fs.readdirSync(dir).find(n => n.startsWith('out.'));
    if (!f) { job.status = 'failed'; job.error = 'Output file missing'; return cleanup(job); }
    job.file = path.join(dir, f);
    const ext = path.extname(f);
    const safe = (job.title || 'video').replace(/[^\w\-]+/g, '_').slice(0, 60);
    job.filename = `${safe}${job.format === 'mp4' ? '_' + (job.height || 'best') + 'p' : ''}${ext}`;
    job.progress = 100; job.stage = 'Ready'; job.status = 'ready';
    job.expiresAt = Date.now() + RETENTION_MS;
  });
}

function cleanup(job) {
  fs.rm(path.join(TMP_DIR, job.id), { recursive: true, force: true }, () => {});
}

setInterval(() => {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (j.expiresAt && now > j.expiresAt) { j.status = 'expired'; cleanup(j); jobs.delete(id); }
    else if (j.status === 'failed' && !j.expiresAt) { j.expiresAt = now + 60000; }
  }
}, 30000);

// ---------- app ----------
const app = express();
app.set('trust proxy', 1);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // e.g. https://kinetix.vercel.app (comma-separated ok)
app.use((req, res, next) => {
  const allowed = CORS_ORIGIN.split(',').map(x => x.trim());
  const origin = req.headers.origin;
  if (allowed.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use('/api/', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false }));
app.use('/api/jobs', rateLimit({ windowMs: 60000, limit: 20, standardHeaders: true, legacyHeaders: false, skip: r => r.method !== 'POST' }));

app.get('/healthz', (req, res) => res.send('ok'));

app.get('/api/info', async (req, res) => {
  const url = parseAllowedUrl(req.query.url);
  if (!url) return res.status(400).json({ error: 'unsupported_source', message: "This video source isn't supported." });
  try { res.json(await getInfo(url)); }
  catch (e) { res.status(422).json({ error: 'probe_failed', message: e.message }); }
});

app.post('/api/jobs', async (req, res) => {
  const { format = 'mp4', height, bitrate, rightsConfirmed } = req.body || {};
  const url = parseAllowedUrl(req.body && req.body.url);
  if (!url) return res.status(400).json({ error: 'unsupported_source' });
  if (!['mp4', 'mp3'].includes(format)) return res.status(400).json({ error: 'bad_format' });
  if (running >= MAX_CONCURRENT) return res.status(503).json({ error: 'busy', message: 'Server is busy, try again in a minute.' });
  let info;
  try { info = await getInfo(url); }
  catch (e) { return res.status(422).json({ error: 'probe_failed', message: e.message }); }
  // Rights gate: open-licensed media passes; anything else needs the user's explicit confirmation.
  if (!info.openLicense && rightsConfirmed !== true) {
    return res.status(403).json({ error: 'rights_required',
      message: 'Confirm you own this video or have permission from the rights holder to save a copy.' });
  }
  const h = Math.min(parseInt(height, 10) || info.maxHeight || 1080, info.maxHeight || 4320);
  const job = newJob({ url, format, height: h, bitrate: /^\d{2,3}K$/i.test(bitrate || '') ? bitrate : '320K', title: info.title });
  runJob(job);
  res.status(202).json({ id: job.id });
});

app.get('/api/jobs/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'not_found' });
  const out = { id: j.id, status: j.status, progress: Math.round(j.progress), stage: j.stage, error: j.error };
  if (j.status === 'ready') {
    out.expiresAt = j.expiresAt;
    out.filename = j.filename;
    out.downloadUrl = `/api/jobs/${j.id}/file?exp=${j.expiresAt}&sig=${sign(j.id, j.expiresAt)}`;
  }
  res.json(out);
});

app.get('/api/jobs/:id/file', (req, res) => {
  const j = jobs.get(req.params.id);
  const exp = Number(req.query.exp), sig = String(req.query.sig || '');
  if (!j || j.status !== 'ready' || !j.file) return res.status(404).json({ error: 'not_found' });
  const good = sign(j.id, exp);
  if (Date.now() > exp || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
    return res.status(403).json({ error: 'expired_or_invalid' });
  }
  res.download(j.file, j.filename); // sets Content-Disposition: attachment, supports Range
});

app.delete('/api/jobs/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'not_found' });
  j.status = 'cancelled';
  if (j.proc) j.proc.kill('SIGTERM'); else cleanup(j);
  jobs.delete(j.id);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.listen(PORT, () => console.log(`Kinetix listening on :${PORT}`));
