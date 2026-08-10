# Setup status — 9 August 2026

## Live and verified

**Supabase** — project `gvsw_estimator_tool` (`hvaqvnpvcnwgvfbhgbze`, us-west-2)
- `jobs`, `corrections`, `config` created; `config` seeded with one row, `next_proposal_no = 1`
- **RLS enabled on all three tables with no policies.** Deliberate: every row is client
  data, the server only ever talks to it with the `service_role` key (which bypasses RLS),
  so a policy-less RLS means the publishable key can read nothing. Supabase's linter
  reports this as an INFO notice — that notice is the desired state, not a defect.

**Resend** — `mail.dogruntwork.com`, **Verified**, us-east-1. Sending AND receiving.
- Free tier allows one custom domain, so both roles live on the one subdomain.
- Side benefit: the tool's sending reputation is isolated from Workspace mail on the root.

**DNS at Namecheap** — verified against the authoritative nameserver, not the UI:

| Type | Host | Value |
|---|---|---|
| TXT | `resend._domainkey.mail` | DKIM, 218 chars, decodes to a valid 162-byte RSA key |
| TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` |
| MX  | `send.mail` | `feedback-smtp.us-east-1.amazonses.com` (bounces) |
| MX  | `mail` | `inbound-smtp.us-east-1.amazonaws.com` — **memos land here** |

Google Workspace untouched: root MX still `1 smtp.google.com`, root SPF still Google's.

**Google Drive** — folder `GVSW Estimates`
- ID `19YrrwEvLmXuyr2V0SOoD1EwSSCvleu9B`, owned by `lindsey@dogruntwork.com`

**Google Cloud** — project `gvsw-estimator`, ID `gvsw-estimator-dgw`, number `396050840439`
- **Owned by `lindsey@dogruntwork.com`** (the business Workspace account), not the personal Gmail
- A `dogruntwork.com` GCP organisation **does** exist — provisioning the project under the
  Workspace account brought it into being. That is what blocks key creation, and it is correct.
- Drive API enabled
- Service account: **`gvsw-estimator@gvsw-estimator-dgw.iam.gserviceaccount.com`**
- Drive folder shared with it as Editor ✓ (and the earlier public-write exposure is closed —
  permissions now read owner + service account only)
- A duplicate project `gvsw-estimator` still exists on `lparker2283@gmail.com` and can be
  deleted whenever you like. Nothing points at it. (Deleting is yours — I don't do irreversible.)

**Workload Identity Federation — complete and verified end to end.**
No service account key exists or ever will. Full detail and the claim-by-claim proof
are in `WIF-SETUP.md`; the short version:
- Pool `vercel` + OIDC provider `vercel`, Allowed audiences, `google.subject` = `assertion.sub`
- `roles/iam.workloadIdentityUser` granted to the production subject principal
- Six `GCP_*` / `DRIVE_FOLDER_ID` variables set in Vercel
- Vercel OIDC federation on, Issuer Mode **Team**
- `iss`, `aud` and `sub` compared character-for-character against what GCP accepts — all three match

*(The console moved the grant: it lives under the service account's **Principals with
access** tab now, not **Permissions**. That relocation is what the old instructions
dead-ended on.)*

## Blocked, needs you

**1. Redeploy `gvsw-estimator-tool`.**
Environment variables only reach a running deployment through a new build — Vercel says
so itself after saving them. One click on Deployments → ⋯ → Redeploy. Left to you because
it publishes to production.

**2. Resend API key + inbound webhook.**
- <https://resend.com/api-keys> → Create → `RESEND_API_KEY`
- Inbound route → webhook `https://<your-vercel-domain>/api/inbound` → copy the
  signing secret to `RESEND_INBOUND_SECRET`.

**3. Namecheap orphan cleanup.** Three stale records from the first, abandoned attempt at
root-domain sending. Delete: TXT `resend._domainkey`, TXT `send`, MX `send`.
**Do not touch `send.mail`** — that one is live and carries bounce handling.

**4. First live run.** A real memo, end to end, with you watching the Drive folder.

## Still not built

- Rate card: only brick, stone, chimney, historic are transcribed. Six categories missing.
- Completeness engine exists for chimney only.
- Correction ledger: schema and write path exist, nothing reads annotations yet.
- Standing config: table seeded but empty, waiting on Dan's worksheet.
