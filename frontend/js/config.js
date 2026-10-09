// @ts-nocheck
/**
 * Tourist Guide & TravelMind AI — Production & Deployment Configuration
 *
 * HOW IT WORKS:
 * 1. Default (Vercel Rewrites):
 *    Leave BACKEND_URL as "" (empty). Requests use the relative path '/api',
 *    which Vercel proxies directly to your Render backend via vercel.json.
 *
 * 2. Direct Backend Connection (CORS):
 *    If you prefer connecting directly to your Render service without Vercel rewrites,
 *    simply paste your Render backend URL here:
 *    BACKEND_URL: "https://your-service.onrender.com"
 *
 * 3. Browser DevTools Quick Override:
 *    You can change or test the backend URL directly in the browser console:
 *    localStorage.setItem('tourist_api_url', 'https://your-service.onrender.com');
 */
window.APP_CONFIG = {
    // Leave empty ("") if using Vercel rewrites in vercel.json, OR paste your deployed Render URL:
    BACKEND_URL: ""
};
