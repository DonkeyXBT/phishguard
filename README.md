# PhishGuard — Email Phishing Detection Platform

A full phishing detection and admin review system with:
- **Backend API** — email analysis engine + REST API
- **Admin Dashboard** — review queue, actions, statistics
- **Browser Extension** — Gmail & Outlook Web integration

## Quick Start

### 1. Start with Docker Compose

```bash
cd phishing-detector
docker-compose up --build
```

- Backend API: http://localhost:8000
- Admin Dashboard: http://localhost:80
- API Docs: http://localhost:8000/docs

### 2. Initialize (first time only)

```bash
curl -X POST http://localhost:8000/api/auth/setup
```

Default credentials: `admin@company.com` / `admin123`

Your organization API key will be returned — save it for the browser extension.

### 3. Install Browser Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `phishing-detector/extension/`
4. Click the PhishGuard icon → enter your server URL and API key

### 4. Test it

Open Gmail or Outlook Web. PhishGuard will scan every email you open.

To test the analysis API directly:

```bash
curl -X POST http://localhost:8000/api/emails/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "sender": "paypa1-support@paypa1-security.xyz",
    "subject": "URGENT: Your account will be suspended in 24 hours!",
    "body_text": "Please verify your password immediately or your account will be terminated. Click here now.",
    "body_html": "<a href=\"http://192.168.1.1/login\">Click here to verify</a>"
  }'
```

## Architecture

```
Browser Extension (Gmail/Outlook)
    ↓ POST /api/emails/analyze   (inline scan while reading)
    ↓ POST /api/emails/report    (when user clicks "Report")

Backend API (FastAPI)
    ├── Phishing analysis engine
    │   ├── Header checks (lookalike domains, reply-to mismatch)
    │   ├── Content NLP (urgency, threats, credential requests)
    │   ├── URL analysis (shorteners, IP URLs, display mismatch)
    │   └── Attachment checks (dangerous types, macros)
    └── Admin REST API

PostgreSQL Database
    ├── email_reports (pending/released/deleted/escalated)
    ├── email_links
    ├── email_attachments
    └── admin_actions (full audit trail)

Admin Dashboard (React)
    ├── /dashboard  — stats overview
    ├── /queue      — review pending reports
    └── /queue/:id  — full email details + admin actions
```

## Admin Actions

| Action | Meaning |
|---|---|
| **Release** | Email is safe, delivered to user |
| **Delete** | Confirmed phishing, removed |
| **False Positive** | Wrongly flagged, marked and released |
| **Escalate** | Needs further investigation |

## Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
# Set DATABASE_URL in .env (or use SQLite by changing config)
uvicorn app.main:app --reload

# Frontend
cd frontend/admin
npm install
npm run dev
```
