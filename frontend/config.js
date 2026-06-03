/**
 * config.js — loaded before app.js in every HTML page.
 *
 * When the frontend is deployed separately (e.g. Vercel) set this to your
 * backend URL (e.g. https://meltimedia.onrender.com).
 *
 * When frontend + backend are served together from the same Express server,
 * leave this as an empty string — relative /api/* calls work fine.
 */
window.API_BASE = 'https://meltimediasystem-3.onrender.com';   // ← paste your Render backend URL here when deploying to Vercel
// e.g. window.API_BASE = 'https://meltimedia.onrender.com';
