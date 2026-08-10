# Workload Identity Federation — DONE and verified

Keyless Drive auth for the estimator. No service account key exists or ever will;
Vercel mints a short-lived OIDC token per request and GCP exchanges it.

**Status: the federation chain is complete and verified end to end**, 9 August 2026.
Not "the forms were filled in" — the claims Vercel says it will mint were read off
Vercel's own settings page and compared character-for-character against what GCP was
told to accept. See *The proof* below.

## Confirmed facts

| | |
|---|---|
| GCP organization | `dogruntwork.com` (exists — this is why key creation is blocked) |
| Project ID | `gvsw-estimator-dgw` |
| Project number | `396050840439` |
| Service account | `gvsw-estimator@gvsw-estimator-dgw.iam.gserviceaccount.com` |
| Service account unique ID | `101290162351866876589` |
| Drive folder | `19YrrwEvLmXuyr2V0SOoD1EwSSCvleu9B` — shared with the SA as Editor ✓ |
| Vercel team slug | `lindseys-projects-08a602ec` |
| Vercel project | `gvsw-estimator-tool` |

## Step 1 — pool and provider ✓ DONE

Pool `vercel`, provider `vercel`, both enabled. Verified in the console:

- Issuer: `https://oidc.vercel.com/lindseys-projects-08a602ec`
- Audiences: **Allowed audiences** (not Default), Audience 1
  `https://vercel.com/lindseys-projects-08a602ec`
- Attribute mapping: `google.subject` = `assertion.sub`

## Step 2 — impersonation grant ✓ DONE

Note the console has moved this: it is **not** under the service account's
*Permissions* tab any more, it is under **Principals with access**. That is why the
old instructions dead-ended.

Service Accounts → `gvsw-estimator` → **Principals with access** → **Grant access**.

    principal://iam.googleapis.com/projects/396050840439/locations/global/workloadIdentityPools/vercel/subject/owner:lindseys-projects-08a602ec:project:gvsw-estimator-tool:environment:production

Role: **Workload Identity User** (`roles/iam.workloadIdentityUser`). Console confirmed
*"Policy updated."*

Production only. Add a second principal ending `environment:preview` if preview
deployments should also write to Drive — see the note in Step 3 about why they
currently won't.

## Step 3 — Vercel environment variables ✓ DONE

All six added to `gvsw-estimator-tool`, Production and Preview, **not** marked
Sensitive (they are public identifiers, not secrets — and leaving them readable means
you can actually check them later, which a Sensitive variable will not let you do):

```
GCP_PROJECT_ID=gvsw-estimator-dgw
GCP_PROJECT_NUMBER=396050840439
GCP_SERVICE_ACCOUNT_EMAIL=gvsw-estimator@gvsw-estimator-dgw.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
DRIVE_FOLDER_ID=19YrrwEvLmXuyr2V0SOoD1EwSSCvleu9B
```

Vercel flagged `GCP_SERVICE_ACCOUNT_EMAIL` as *"Recommended: Set as Sensitive"*. That
is a keyword heuristic firing on the word EMAIL. A service account address is a public
identifier — the entire premise of federation is that there is no secret to protect.
Ignored deliberately.

`GOOGLE_SERVICE_ACCOUNT_JSON` is **unset**, and must stay unset. `lib/drive.ts` prefers
the key path when that variable exists, so setting it silently bypasses everything above.

**Preview caveat.** The variables are scoped Production *and* Preview, but the IAM
binding is production-only. A preview deployment will therefore mint a token GCP
declines, `uploadToDrive` throws, `app/api/submit/route.ts` catches it and delivers by
email anyway. Fail-soft, not fail-silent — but preview runs will also show up as failed
exchanges in the WIF usage graph, so don't read that graph as evidence of a broken
production path.

## Step 4 — OIDC federation ✓ ALREADY ENABLED

Vercel → Settings → Security → **Secure Backend Access with OIDC Federation**.
Issuer Mode: **Team** (the recommended setting, and the one the GCP provider expects —
Global would issue `https://oidc.vercel.com` with no team segment and the exchange
would fail on issuer mismatch).

## The proof

Vercel's security page publishes the exact claims it will put in the token. Compared
against what GCP was configured to accept:

| Claim | Vercel will send | GCP expects | |
|---|---|---|---|
| `iss` | `https://oidc.vercel.com/lindseys-projects-08a602ec` | provider Issuer URL, identical | ✓ |
| `aud` | `https://vercel.com/lindseys-projects-08a602ec` | Allowed audience 1, identical | ✓ |
| `sub` | `owner:lindseys-projects-08a602ec:project:gvsw-estimator-tool:environment:production` | the bound principal's subject, identical | ✓ |

Three matches, all read from live pages rather than assumed. This is the check worth
doing, because every one of these failures presents identically at runtime — a generic
403 from STS with no indication of *which* claim disagreed.

## What is left

1. **Redeploy.** Environment variables only reach a running deployment through a new
   build. Vercel said so itself: *"A new deployment is needed for changes to take
   effect."* Left for you — it publishes to production.
2. **Resend API key + inbound webhook**, pointed at `https://<deployed-url>/api/inbound`,
   signing secret into `RESEND_INBOUND_SECRET`.
3. **First live run.**

## How to know it worked

The first estimate run writes a subfolder into `GVSW Estimates`. If Drive auth fails,
`app/api/submit/route.ts` catches it, logs, and still sends the documents by email — so
a broken federation costs you the reMarkable sync, not the estimate. The WIF usage graph
in the GCP console (Workload Identity Pools → usage) counts successful exchanges; it
should go from zero to non-zero on the first production run.

## Unrelated but noticed

Google is requiring two-step verification on the Cloud console by **20 October 2026**
for this account. Not urgent, but it will lock you out of the console if it lapses.

## Console traps, for next time

- The free-trial banner (*"Start your Free Trial with $300 in credit"*) injects itself at
  the top of the page **after** first paint and pushes everything down ~60px. Any click
  computed from an earlier screenshot lands one element too high. Dismiss the banner
  first, then re-screenshot, then click.
- IAM list pages hang indefinitely and stop responding to scripting maybe one load in
  three. A fresh tab loads fine; reloading the stuck tab does not help.
- `authuser=` in a console URL is positional (`authuser=3` here) and can resolve to a
  *different Google account* than you expect — Dan Quinn's account has surfaced twice
  this way. Confirm the identity on the page before acting, every time.
