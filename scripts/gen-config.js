// Vercel build step: writes public/config.js from the KX_API_BASE env var.
const fs = require('fs');
const base = (process.env.KX_API_BASE || '').trim();
if (!base) console.warn('WARNING: KX_API_BASE is not set. The app will call /api on the same origin.');
fs.writeFileSync('public/config.js', `window.KX_API_BASE = ${JSON.stringify(base)};\n`);
console.log('config.js written, API base =', base || '(same origin)');
