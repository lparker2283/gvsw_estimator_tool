# Setup status — 24 August 2026

## Live and verified

**Supabase** — project `gvsw_estimator_tool` (`hvaqvnpvcnwgvfbhgbze`, us-west-2)
- `jobs`, `inbound_failures`, `corrections`, `config` created; `config` seeded with one
  row, `next_proposal_no = 1`
- `corrections` carries `event_id` and `confidence`, with the unique index on `event_id`
  and a `created_at desc` index. The correction migration has been run.
- **RLS enabled on all four tables with no policies.** Deliberate: every row is client
  data, the server only ever talks to it with the `service_role` key (which bypasses RLS),
  so a policy-less RLS means the publishable key can read nothing. Supabase's linter
  reports this as an INFO notice — that notice is the desired state, not a defect.
  `inbound_failures` was added after the first three and came up without RLS; it has it
  now, and `schema.sql` states it for every table so a new one cannot skip it again.

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

**Done since the 9th** — all four of the items that were blocked on Lindsey:
redeploy, `RESEND_API_KEY`, the inbound webhook and its `RESEND_INBOUND_SECRET`,
and the three orphan Namecheap records (`resend._domainkey`, TXT `send`, MX `send`)
deleted with `send.mail` left alone.

## Blocked, needs you

**1. First live run of each direction.**
- A real memo in, watching the Drive folder. `HUMAN_IN_THE_LOOP=true` keeps the
  documents coming to you rather than to Dan.
- Then reply to that delivery with the PDF marked up, and check that rows land in
  `corrections`. This path has never run against a real message.

## Still not built

- Rate card: only brick, stone, chimney, historic are transcribed. Six categories missing —
  a patio or a foundation job still hits a wall.
- Completeness engine exists for chimney only; every other category falls back to
  generic reasoning.
- Standing config: table seeded but empty, waiting on Dan's worksheet. Nothing reads it yet.
- Client-facing documents: parked in `lib/docs/parked/`, deliberately unwired. They come
  back when the ledger has taught the tool something worth putting in front of a client.
- Multi-tenant: brand tokens exist and the page and email read from them, but the
  documents still hardcode GVSW in `lib/docs/shared.ts` and no job carries a brand key.

## Done, as of 24 August

- Four documents collapsed to one internal brief for Dan, built around the five things
  he needs before he can quote. The chimney-specific narrative is gone from the templates.
- The correction loop closes: he replies to the delivery email with the marked-up PDF,
  inbound routes on attachment type, Claude reads the marks against the numbered lines,
  and prior corrections feed back into extraction and pricing.
- `npm run smoke` renders the brief from two fixtures; `npm run email` renders the
  delivery email. Neither needs a key or the network.
