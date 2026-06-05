/**
 * config.js — loaded before app.js in every HTML page.
 *
 * LOCAL DEVELOPMENT (running on localhost):
 *   Leave API_BASE as empty string — all /api/* calls go to the same server.
 *
 * PRODUCTION (frontend on Vercel, backend on Render):
 *   Set API_BASE to your Render backend URL:
 *   window.API_BASE = 'https://meltimediasystem-2.onrender.com';
 */
window.API_BASE = '';
