# 🚀 Deployment Guide: Render (Backend) & Vercel (Frontend)

This guide walks you through deploying the **Tourist Guide & TravelMind AI** project with the industry-standard decoupled architecture:
* **Backend:** Hosted on **[Render](https://render.com/)** as a Dockerized Java 17 + Spring Boot 3 Web Service.
* **Frontend:** Hosted on **[Vercel](https://vercel.com/)** as high-performance global static web assets with zero cold starts.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: MongoDB Atlas Preparation](#step-1-mongodb-atlas-preparation)
3. [Step 2: Backend Deployment on Render](#step-2-backend-deployment-on-render)
4. [Step 3: Frontend Deployment on Vercel](#step-3-frontend-deployment-on-vercel)
5. [Step 4: Linking Frontend to Backend](#step-4-linking-frontend-to-backend)
6. [Verification & Health Checks](#verification--health-checks)
7. [Troubleshooting & Tips](#troubleshooting--tips)

---

## 1. Prerequisites

Before starting, ensure you have:
1. A **GitHub** account with this repository pushed: `https://github.com/KABI1212/tourist-chatbot`
2. A free **[Render](https://render.com/)** account
3. A free **[Vercel](https://vercel.com/)** account
4. A free **[MongoDB Atlas](https://www.mongodb.com/atlas)** account
5. A **[Google AI Studio](https://aistudio.google.com/)** Gemini API Key

---

## Step 1: MongoDB Atlas Preparation

Render dynamic IP addresses change over time. You must allow traffic from anywhere in MongoDB Atlas:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. In the left navigation, click **Network Access** under Security.
3. Click **Add IP Address**.
4. Click **Allow Access from Anywhere** (`0.0.0.0/0`).
5. Click **Confirm**.
6. Under **Database Access**, verify your database user has read and write privileges and note your password.
7. Click **Database** -> **Connect** -> **Drivers** and copy your connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/tourist_chatbot?retryWrites=true&w=majority
   ```

---

## Step 2: Backend Deployment on Render

Render runs the Java 17 Spring Boot backend inside the optimized multi-stage Docker container defined in `backend/Dockerfile` and root `Dockerfile`.

### Option A: 1-Click Render Blueprint (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Select your GitHub repository: `tourist-chatbot`.
4. Render will automatically detect `render.yaml`.
5. Enter your environment variables:
   * `MONGODB_URI`: Your MongoDB Atlas URI.
   * `GEMINI_API_KEY`: Your Google Gemini API Key.
6. Click **Apply**. Render will automatically build the Docker container and start your service!

---

### Option B: Manual Web Service Setup on Render
1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Select **Build and deploy from a Git repository** and pick `tourist-chatbot`.
4. Configure the settings:
   * **Name:** `tourist-chatbot-backend` (or any name you choose)
   * **Region:** Select the region closest to you (e.g., Singapore, Frankfurt, Oregon, Ohio)
   * **Root Directory:** `backend` (or leave blank if using root Dockerfile)
   * **Runtime:** Select **Docker**
   * **Dockerfile Path:** `Dockerfile` (or `./backend/Dockerfile` if Root Directory is blank)
   * **Instance Type:** **Free**
5. Expand **Advanced** and set:
   * **Health Check Path:** `/api/health`
6. Under **Environment Variables**, click **Add Environment Variable** for each:
   | Key | Value | Notes |
   |---|---|---|
   | `PORT` | `10000` | Render standard port |
   | `MONGODB_URI` | `mongodb+srv://user:pass@cluster0...` | Full connection URI |
   | `DATABASE_NAME` | `tourist_chatbot` | Database name |
   | `GEMINI_API_KEY` | `AIzaSy...` | Your Gemini API Key |
   | `JWT_SECRET` | `404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970` | 256-bit secret string |
7. Click **Create Web Service**.
8. Wait 3–5 minutes for Maven to package the JAR and start the container.
9. When status is **Live**, copy your Render service URL (e.g. `https://tourist-chatbot-backend.onrender.com`).

---

## Step 3: Frontend Deployment on Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository: `tourist-chatbot`.
4. In the configuration screen:
   * **Project Name:** `tourist-chatbot` (or your choice)
   * **Framework Preset:** Select **Other**
   * **Root Directory:**
     * You can leave it as `./` (the root `vercel.json` automatically serves the `frontend` folder).
     * Or click **Edit** and select `frontend`.
   * **Build and Output Settings:** Leave defaults (no build command needed for Vanilla HTML/CSS/JS).
5. Click **Deploy**.
6. Within seconds, Vercel will deploy your site and provide a URL (e.g., `https://tourist-chatbot.vercel.app`).

---

## Step 4: Linking Frontend to Backend

You have two easy ways to connect your Vercel frontend to your Render backend:

### Method 1: Using Vercel Rewrites (Proxy - No CORS issues)
This is configured out-of-the-box in `vercel.json` and `frontend/vercel.json`:
1. Open `vercel.json` (and `frontend/vercel.json`).
2. Replace `https://tourist-chatbot-backend.onrender.com` with your actual Render URL:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:match*",
         "destination": "https://YOUR-ACTUAL-RENDER-URL.onrender.com/api/:match*"
       }
     ]
   }
   ```
3. Commit and push to GitHub:
   ```bash
   git add vercel.json frontend/vercel.json
   git commit -m "Update Render backend URL in vercel.json"
   git push origin main
   ```
4. Vercel will automatically redeploy with the new rewrites.

---

### Method 2: Direct Connection via `frontend/js/config.js`
If you don't want to use Vercel rewrites:
1. Open `frontend/js/config.js`.
2. Paste your Render backend URL into `BACKEND_URL`:
   ```javascript
   window.APP_CONFIG = {
       BACKEND_URL: "https://YOUR-ACTUAL-RENDER-URL.onrender.com"
   };
   ```
3. Commit and push to GitHub:
   ```bash
   git add frontend/js/config.js
   git commit -m "Set production backend URL in config.js"
   git push origin main
   ```
4. The Spring Boot backend's CORS configuration is already configured to accept requests from your Vercel domain!

---

## Verification & Health Checks

Once deployed, test your endpoints:

### 1. Backend Health Check
Open your browser or terminal and run:
```bash
curl https://YOUR-RENDER-URL.onrender.com/api/health
```
Expected response:
```json
{
  "success": true,
  "message": "Service is healthy and operational",
  "data": {
    "status": "UP",
    "service": "tourist-chatbot-api",
    "timestamp": "2026-10-08T10:48:00Z"
  }
}
```

### 2. Destination Catalog Test
```bash
curl https://YOUR-RENDER-URL.onrender.com/api/destinations
```
Should return the seeded travel catalog.

### 3. Frontend End-to-End Test
1. Visit your Vercel URL (e.g. `https://tourist-chatbot.vercel.app`).
2. Click **Explore Destinations** to confirm catalog loads.
3. Click **Register** or **Login** (`demo` / `demo123`).
4. Open **AI Chatbot** and send: `"Plan a 3-day itinerary for Paris"`.

---

## Troubleshooting & Tips

### 💤 Render Free Tier Cold Starts
* **Behavior:** Free Web Services on Render sleep after 15 minutes of inactivity.
* **Impact:** The very first request after sleeping takes **30–50 seconds** to boot. Subsequent requests are instant.
* **Keep-Alive Tip:** You can use a free uptime monitoring service like [UptimeRobot](https://uptimerobot.com/) or [Cron-job.org](https://cron-job.org/) to ping `https://YOUR-RENDER-URL.onrender.com/api/health` every 14 minutes to prevent it from going to sleep.

### 🛡️ CORS Issues
* If you see `CORS error` in the browser console, ensure your requests either:
  1. Go through Vercel rewrites (`/api/...`), OR
  2. You have your Render URL in `frontend/js/config.js`.
* The backend `SecurityConfig.java` allows all origins with `setAllowedOriginPatterns(List.of("*"))` and `allowCredentials(true)`.

### 🗄️ MongoDB Connection Failures
* Ensure MongoDB Atlas **Network Access** includes `0.0.0.0/0`.
* Ensure your database username and password in `MONGODB_URI` have no unencoded special characters (e.g. replace `@` with `%40`).

### ⚙️ Quick Browser Test in DevTools
You can test connecting any frontend instance to any backend without redeploying by typing this in your browser DevTools Console:
```javascript
Api.setBaseUrl('https://YOUR-RENDER-URL.onrender.com/api');
```
This stores the URL in `localStorage` and reloads the page immediately with the new target backend!
