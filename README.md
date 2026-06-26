# JobPilot – AI Job Application Tracker (Chrome Extension)

JobPilot is a production-quality Chrome extension built with React, TypeScript, Node.js, PostgreSQL, and Google Gemini AI. It automatically detects and scrapes job postings on **LinkedIn**, **Naukri**, and **Wellfound** in real-time. It enables applicants to save and track job applications across states (Wishlist, Applied, OA, Interview, Offer, Rejected), analyze their resume fit using Gemini, identify missing skill gaps, and generate customized cover letters and interview prep questions.

---

## System Architecture

```
                    Chrome Browser
       ┌──────────────────────────────────────┐
       │     LinkedIn / Naukri / Wellfound    │
       └──────────────────┬───────────────────┘
                          │
                   Content Script
             (Scrapes DOM details on load/SPA)
                          │
             Chrome Runtime Messaging API
                          │
               Background Service Worker
             (Manages alarms & notifications)
                          │
       ┌──────────────────┴───────────────────┐
       │                                      │
  IndexedDB / Local Cache               Express API Server
  (Offline state support)             (Node.js + TypeScript)
                                              │
                                      ┌───────┴───────┐
                                      │               │
                                 PostgreSQL      Google Gemini
                                  Database          AI API
```

---

## Folder Layout

```
jobpilot/
├── README.md                  # Detailed developer setup documentation
├── backend/                   # Node.js Express API Server
│   ├── package.json           # Node configuration & dependencies
│   ├── tsconfig.json          # TypeScript configurations
│   ├── .env                   # Local environment file (with DB and AI settings)
│   ├── src/
│   │   ├── index.ts           # App startup and CORS middleware
│   │   ├── config/db.ts       # PostgreSQL client & Mock JSON fallback engine
│   │   ├── middleware/auth.ts # JWT Authenticator
│   │   ├── controllers/       # Controller logic (Auth, Jobs, AI)
│   │   ├── routes/            # Routes (Auth, Jobs, AI endpoints)
│   │   └── database/
│   │       └── schema.sql     # Database table schema script
│   └── db_store.json          # Persistent Mock DB storage (auto-created in mock mode)
└── extension/                 # Chrome Extension Frontend
    ├── package.json           # Vite and React configurations
    ├── tsconfig.json          # Browser TS configuration
    ├── vite.config.ts         # Multi-target bundler for Manifest V3
    ├── index.html             # React App popup container
    └── src/
        ├── popup/             # Popup UI (App, Login, Dashboard, JobPanel)
        ├── content/           # Scrapers (LinkedIn, Naukri, Wellfound, dispatcher)
        ├── background/        # Service worker for alarm followups & notifications
        ├── services/          # Storage utilities and network API calls
        └── types/             # Shared TypeScript typings
```

---

## Detailed Installation & Setup

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24.8.0)
- **NPM**: v10+ (tested on NPM v11.6.0)
- **PostgreSQL** (Optional, falls back to local JSON persistence automatically)

---

### 2. Backend Server Setup

1. Open your terminal and navigate to the backend:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environmental configurations:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Customize `.env` as required:
     - `PORT=5001` (to avoid common port 5000 conflicts)
     - `USE_MOCK_DB=true` (Uses local JSON persistence at `backend/db_store.json`. Set to `false` and provide `DATABASE_URL` to connect to PostgreSQL)
     - `GEMINI_API_KEY=` (Provide a Google Gemini API Key. If empty, the app runs on a smart local regex & generation fallback engine for testing)

4. Compile the typescript code:
   ```bash
   npm run build
   ```
5. Start the server:
   ```bash
   npm run start
   ```
   The backend will be running at `http://localhost:5001`.

---

### 3. Chrome Extension Build & Installation

1. Navigate to the extension folder:
   ```bash
   cd extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension popup, background, and content scripts:
   ```bash
   npm run build
   ```
   This generates the compiled bundle in the `extension/dist` folder.

4. Load the extension in Google Chrome:
   - Open your Chrome browser and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** (top-left button).
   - Select the `extension/dist` folder from your local workspace.
   - The JobPilot wings logo will appear in your Chrome toolbar.

---

## How Features Work

### 🛠️ Auto Job Detection
When you load a job posting on LinkedIn (`linkedin.com/jobs/view/*`), Naukri, or Wellfound, the extension content script reads the active webpage structure. It extracts relevant details (company, role name, location, estimated salary, skills requirement, and job description text) and saves them dynamically to local storage. Opening the popup lights up the panel instantly.

### 📊 Resume Match Fit & Missing Skills
Once you paste your plain-text resume into the **Resume** tab on the Dashboard, you can select the **Check Fit** button on any job panel. The backend queries Google Gemini (or uses the local skill-mapping fallback) to generate an ATS compatibility score, extract matching vs. missing technologies, and output a candidate recommendations summary.

### 📝 Cover Letter Generator
Select **Cover Letter** to draft a 3-paragraph tailored cover letter referencing the job details and matching resume skills. You can review the letter directly in the popup and click **Copy Letter** to paste it immediately.

### 💡 Interview prep (QA Builder)
Select **Prep QA** to build custom interview preparation questions categorized into:
- **HR & Behavioral**: Scenario questions based on your background and the target company values.
- **Technical Qs**: Conceptual questions focused on matching skills.
- **System Design & Architecture**: Designing specific scaled systems relative to the target company.

### ⏰ Background Follow-Up Alarms
The background service worker configures a custom `chrome.alarm`. Every hour, it checks your saved job list. If you applied to a job 7 or more days ago and have not received updates, it triggers a desktop notification: *"Have you heard back? Time to send a follow-up email."*

---

## Production Deployment

### 1. Backend Server Deployment (Render Blueprint)
We have prepared a **`render.yaml`** file at the root of the project to allow automated infrastructure deployment on Render:
1. Push this project workspace to your **GitHub** account.
2. Sign in to the **Render Dashboard** (`https://dashboard.render.com/`).
3. Click **New** -> **Blueprint**.
4. Link your GitHub repository.
5. Render will detect the `render.yaml` configuration and automatically provision:
   - A managed **PostgreSQL Database** instance.
   - An **Express Web Service** compiled and served from the `backend/` directory.
6. Enter your `GEMINI_API_KEY` under the Environment Variables section in your web service settings.

### 2. Chrome Extension Production Distribution
To share the extension with others or submit to the Chrome Web Store:
1. Locate the **`jobpilot-extension.zip`** file created at the root of the workspace.
2. Share this ZIP archive with users (they can unzip and click **Load unpacked** inside Chrome) or upload it directly to the **Chrome Web Store Developer Console** to publish the extension.

