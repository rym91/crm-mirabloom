# n8n workflows for the CRM

Two importable workflows that connect the existing n8n (on Contabo) to the CRM.
The CRM is reachable from n8n over the shared `web` docker network as `http://crm:3000`
(no public exposure of the machine endpoints needed). See `docs/11-deploy-runbook.md`.

## Import
In n8n: **Workflows → Add → Import from File** (or open a blank workflow and **paste the JSON onto the canvas**).

## 1. inbound-workflow.json — incoming supplier replies
Email Trigger (IMAP) → Build CRM payload (Code) → POST to CRM.
After import, set:
1. **IMAP credential** on the trigger node: host `imap.hostinger.com`, port `993`, SSL on, user `hello@mirabloom.eu`, password = mailbox password.
2. **`PASTE_CRM_INBOUND_SECRET_HERE`** in the "POST to CRM" node header `X-CRM-Secret` → the value of `CRM_INBOUND_SECRET` from `/opt/crm/.env.production`.
3. Activate the workflow.

⚠️ Field mapping: the IMAP node's output field names can vary slightly by n8n version. The Code
node reads them defensively, but after import run the trigger once (Fetch Test Event) and confirm
the "Build CRM payload" output has non-empty `messageId`, `from`, `subject`, `bodyText`.

## 2. followups-cron.json — scheduled follow-ups
Schedule (every 12h) → GET CRM `/api/cron/followups`.
After import, set **`PASTE_CRON_SECRET_HERE`** (header `x-cron-secret`) → `CRON_SECRET` from `.env.production`. Activate.

Both HTTP nodes use `neverError: true` so n8n doesn't mark a run failed on a 4xx — check the
node output (`{ ok: true, ... }`) instead.
