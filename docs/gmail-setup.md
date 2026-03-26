# Gmail Inbound Setup

FamOS reads school emails from a shared Google Workspace mailbox (`inbox@famops.app`) using the Gmail API. This document covers everything needed to configure it.

---

## Architecture overview

```
School email → forwarded by parent → inbox@famops.app (Google Workspace)
  → Gmail API (polled every 10 min by cron) → POST /api/cron/gmail-sync
    → ingestNewGmailMessages() → emails table → OpenAI extraction → dashboard
```

- **Polling, not webhooks.** The cron endpoint is called on a schedule; no Google push infrastructure required.
- **Postmark is bypassed.** The old `POST /api/inbound/email/:token` route returns 200 immediately. Code is intact for re-enabling if needed.
- **Resend is unchanged.** Outbound digest delivery is unaffected.

---

## Authentication approach

**Service account with domain-wide delegation** — the simplest safe approach for a single shared mailbox on Google Workspace.

- No OAuth user flow
- No refresh token management
- Service account impersonates `inbox@famops.app` server-side

---

## One-time setup

### Step 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create or select a project.
2. Enable the **Gmail API**: APIs & Services → Library → search "Gmail API" → Enable.
3. Go to **IAM & Admin → Service Accounts** → Create service account.
   - Name: `famos-inbound` (or any name)
   - No roles needed at the project level
4. Open the new service account → **Keys** tab → **Add Key → Create new key → JSON**.
   - Download the JSON file — you'll need two fields from it: `client_email` and `private_key`.
5. Note the **Client ID** from the service account overview (a long numeric string) — needed for the next step.

### Step 2 — Google Workspace Admin

1. Sign in to [admin.google.com](https://admin.google.com).
2. Go to **Security → Access and data control → API controls → Manage domain-wide delegation**.
3. Click **Add new** and enter:
   - **Client ID**: (from Step 1, the long numeric string)
   - **OAuth scopes**: `https://www.googleapis.com/auth/gmail.modify`
4. Save.

### Step 3 — Replit environment secrets

Add these two secrets in Replit (Settings → Secrets):

| Secret name | Value |
|---|---|
| `GMAIL_CLIENT_EMAIL` | The `client_email` field from the JSON key file |
| `GMAIL_PRIVATE_KEY` | The `private_key` field from the JSON key file (paste in full, including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) |

`GMAIL_INBOUND_ADDRESS` defaults to `inbox@famops.app`. Set it only if you change the mailbox.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GMAIL_CLIENT_EMAIL` | Yes | — | Service account email address |
| `GMAIL_PRIVATE_KEY` | Yes | — | Service account private key (PEM format) |
| `GMAIL_INBOUND_ADDRESS` | No | `inbox@famops.app` | Mailbox to poll |
| `CRON_SECRET` | Yes | — | Protects the `/api/cron/gmail-sync` endpoint |

---

## Endpoints

### Production polling (scheduler)

```
POST /api/cron/gmail-sync
Header: x-cron-secret: <CRON_SECRET>
```

Returns: `{ "processed": N, "skipped": N, "errors": N }`

Schedule this every 10 minutes via [cron-job.org](https://cron-job.org) or equivalent.

### Dev/manual trigger (browser-safe)

```
POST /api/dev/gmail-sync
Header: Authorization: Bearer <user JWT>
```

Requires auth + dev user access. Callable from the Dev Tools page in the app.

### Inspect recent ingested emails

```
GET /api/dev/gmail-inbox
Header: Authorization: Bearer <user JWT>
```

Returns the 20 most recently ingested Gmail messages with their processing status.

---

## Local development

In local dev, Gmail polling is disabled by default — no credentials are set, and no scheduler is running.

To test locally:
1. Set `GMAIL_CLIENT_EMAIL` and `GMAIL_PRIVATE_KEY` in your local `.env` (never commit these).
2. Call `POST /api/dev/gmail-sync` from the Dev Tools page or via curl.
3. Alternatively, use the Email Extraction Tester on the Dev Tools page to test extraction without live Gmail.

---

## Production behavior

- `/api/cron/gmail-sync` is called every 10 minutes by the external scheduler.
- On each poll, up to 50 unread messages are fetched and processed.
- Each message is marked as read after being stored, so it won't be re-fetched.
- Idempotency: `source_message_id` (Gmail message ID) is stored on every email row. If the same message is seen again (e.g. marked unread manually), the dedup check prevents double-processing.

---

## Test plan — 5 forwarded school email scenarios

Use a Gmail account registered in FamOS and forward these to `inbox@famops.app`. After each send, trigger a sync from Dev Tools and verify on the dashboard.

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | **Event + deadline in one email** — "Spring Concert Thursday at 6:30pm; permission slips due Friday" | 1 event, 1 deadline extracted |
| 2 | **Action item with urgency** — "Please return the medication form by April 1st" | 1 high-priority action item |
| 3 | **Multi-child email** — mentions two children by name | Items attributed to correct children; fuzzy match handles nicknames |
| 4 | **Informational only** — newsletter with no dates or deadlines | 1 or more notes; no events/deadlines/actions |
| 5 | **HTML-only email** — forward from a school system that sends no plain text | Body is stripped from HTML; extraction still works |

After each test: open Dev Tools → Gmail Sync panel → inspect the ingested email row. Confirm `processing_status = processed` and verify items on the dashboard.

---

## Rollback

To re-enable Postmark:
1. Remove the 2-line bypass at the top of `artifacts/api-server/src/routes/inbound.ts`.
2. Ensure `POSTMARK_INBOUND_TOKEN` is set.
3. Update the Postmark webhook URL in the Postmark dashboard to your production domain.

The Gmail polling can be disabled by simply not calling the cron endpoint.
