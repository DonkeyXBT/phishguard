# PhishGuard — Outlook Add-in Deployment Guide

## Prerequisites
- Microsoft 365 tenant with admin access
- PhishGuard server deployed (Vercel URL already in manifest)

---

## Step 1 — Get the API key

1. Log in to your PhishGuard dashboard
2. Go to **Organizations** and create an organization for your company
3. Click **Setup Guide** to copy the **API Key**

---

## Step 2 — Deploy via Microsoft 365 Admin Center

1. Go to [admin.microsoft.com](https://admin.microsoft.com)
2. Navigate to **Settings → Integrated apps**
3. Click **Upload custom apps**
4. Select **Office Add-in** as the app type
5. Choose **Upload manifest file (.xml)** and upload `manifest.xml` from this folder
6. Click **Next** and assign to users:
   - **Everyone** — rolls out to your whole organization
   - **Specific users / groups** — pilot rollout
7. Click **Finish**

Deployment takes **up to 24 hours** to propagate to all users.

---

## Step 3 — Users configure the API key (once per user)

When a user first opens the add-in in Outlook:
1. The settings panel opens automatically
2. The **Server URL** is pre-filled — leave it as-is
3. Paste the **API Key** from Step 1
4. Click **Save Settings**

The API key is stored in Microsoft's roaming settings and syncs across the user's devices automatically — they only need to enter it once.

---

## How it works

- A **PhishGuard** button appears in the Outlook reading toolbar
- Clicking it opens a side panel that analyzes the currently open email
- Results show the risk level (Safe / Possible Phishing / Likely Phishing / Phishing Detected) with a score and signal breakdown
- Users can click **Report as Phishing** to send the email to the security team's review queue
- Admins review reported emails in the PhishGuard dashboard and can mark them as deleted, released, or escalated

---

## Updating the manifest

If the server URL changes, update the URL in `manifest.xml` and re-upload it in the Admin Center under **Settings → Integrated apps → PhishGuard → Update**.
