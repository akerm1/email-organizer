# EmailVault Pro

A mobile-first PWA for managing email accounts and their monthly expiry days, with automatic daily notifications (browser + Telegram) at **9:46 AM Algeria time (UTC+1)**.

## Features

- **Dashboard** — stats, expiry-distribution & health charts, recent activity
- **Accounts** — searchable/sortable table with client & status filters, bulk select/delete/export, pagination
- **Add Account** — single form or **Bulk** tab (paste one email per line; per-line day override via `,15` or `.15`)
- **Expiring / Problems** — dedicated views with one-click and resolve-all actions
- **Analytics** — trends, client distribution, status breakdown
- **Notifications** — configurable daily digest (browser + Telegram)
- **PWA** — installable, offline-ready with a service worker

## Stack

- Vanilla JS (modular: `js/*.js`) + Chart.js
- Firebase (Cloud Firestore) — web SDK in the browser
- `check-expiry.js` — Node cron-style checker powered by `firebase-admin`

## Getting started

```bash
npm install
npm run dev          # serves the app locally (npx serve .)
node check-expiry.js # runs one notification check (needs .env)
```

Firebase web config lives in `js/firebase-config.js`; the server-side checker reads a `FIREBASE_SERVICE_ACCOUNT` JSON from `.env`.

## Scripts

| Script    | Purpose                                    |
| --------- | ------------------------------------------ |
| `check`   | Run the expiry check once                  |
| `start`   | Alias for `check`                          |
| `dev`     | Serve the PWA locally                      |

## Notifications

Settings (mode, advance days, time) are stored in `localStorage` under `emailVaultNotifications`. The server checker sends Telegram alerts for the same accounts every day at 9:46 AM Algeria time.