# GVSW Estimator

Dan emails a voice memo. He gets back four documents.

```
voice memo  →  email  →  transcribe  →  extract  →  3-5 questions  →  price  →  4 PDFs
                                                     (one screen)        ↓
                                              email + Drive → reMarkable → he marks it up → correction ledger
```

**Design rule the whole thing hangs on:** the tool never invents a number it
was not given a basis for. Equipment nobody has quoted comes back NOT PRICED,
with a call sheet instead. Everything assumed is listed as assumed.

---

## Setup — about 45 minutes

Work top to bottom. Each step gives you a value for `.env`; copy
`.env.example` to `.env.local` and fill as you go.

### 1 · Supabase — state  (5 min, free)

1. <https://supabase.com/dashboard> → **New project**. Any region.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

> The `service_role` key bypasses row-level security. Server-side only. Never in the browser.

### 2 · Groq — transcription  (2 min, free)

1. <https://console.groq.com/keys> → **Create API Key** → `GROQ_API_KEY`
2. Leave `TRANSCRIBE_PROVIDER=groq`.

Model is `whisper-large-v3-turbo` at $0.04/hour of audio. Dan's volume is
about an hour a *year*. This will not cost money.

### 3 · Anthropic — the brain  (3 min)

1. <https://console.anthropic.com/settings/keys> → **Create Key** → `ANTHROPIC_API_KEY`
2. **Billing** → add $5. Each estimate runs a few cents.

### 4 · Resend — email in and out  (10 min, free tier)

1. <https://resend.com/domains> → **Add Domain** → `dogruntwork.com`
2. Add the DNS records it shows you at your registrar. Verification is usually
   minutes. **You need DNS access for this step** — it is the only one with a
   real dependency outside the dashboards.
3. <https://resend.com/api-keys> → **Create** (full access) → `RESEND_API_KEY`
4. **Inbound** → add address `estimates@dogruntwork.com`, webhook
   `https://estimator.dogruntwork.com/api/inbound`. Copy the signing secret →
   `RESEND_INBOUND_SECRET`.
   *(Come back and set the webhook after step 6 if the domain isn't live yet.)*
5. Set `MAIL_FROM="GVSW Estimator <estimates@dogruntwork.com>"`, `DAN_EMAIL`,
   and `CC_EMAIL` to your own address.

### 5 · Google Drive — the path onto the reMarkable  (10 min, free)

1. <https://console.cloud.google.com/> → **New Project**.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **Credentials → Create credentials → Service account**. Name it `gvsw-estimator`.
4. Open it → **Keys → Add key → JSON**. A file downloads.
5. Base64 it and paste into `GOOGLE_SERVICE_ACCOUNT_JSON`:
   ```bash
   base64 -i ~/Downloads/gvsw-estimator-xxxx.json | tr -d '\n' | pbcopy
   ```
6. In Drive, create a folder **GVSW Estimates**. Share it (Editor) with the
   service account's `client_email` — it looks like
   `gvsw-estimator@project.iam.gserviceaccount.com`.
7. Open the folder; the URL ends in the folder ID → `DRIVE_FOLDER_ID`.

### 6 · Vercel — deploy  (5 min, free)

1. Push this repo to GitHub.
2. <https://vercel.com/new> → import it.
3. **Environment Variables** → paste everything from `.env.local`.
4. Deploy. Then **Settings → Domains** → add `estimator.dogruntwork.com` and
   add the CNAME it gives you at your registrar.
5. Set `APP_URL` to that domain and redeploy.
6. Go back to Resend step 4.4 and point the inbound webhook at
   `https://estimator.dogruntwork.com/api/inbound`.

### 7 · Dan's reMarkable  (5 min — needs reMarkable Connect)

On the device: **Settings → Account → Cloud services → Google Drive** → connect,
and **scope the grant to the `GVSW Estimates` folder only**. PDFs dropped there
appear on the tablet; marked-up files sync back with the handwriting flattened.

Without a Connect subscription he still gets everything by email — he just has
to move files onto the device himself.

---

## First run

Keep `HUMAN_IN_THE_LOOP=true` until you have seen five or six estimates. In
that mode documents go to `CC_EMAIL` — you — not to Dan. You are the safety
net while the completeness engine is still only good at chimneys.

```bash
npm install
npm run smoke     # renders every template from a fixture, no keys needed
```

Then email a voice memo to `estimates@dogruntwork.com` from your own address
and watch it come back.

---

## What is real and what is not

| Piece | State |
|---|---|
| Rate card — brick, stone, chimney, historic | transcribed and verified |
| Rate card — foundation, stucco, water features, flatwork, retaining walls, tile | **not transcribed.** A patio job hits a wall today |
| Completeness engine — chimney | complete |
| Completeness engine — every other category | **not written.** Falls back to generic reasoning |
| Document templates | all four, HTML → PDF |
| Arithmetic validation | deterministic guards in `lib/price.ts` |
| Correction ledger | schema and write path exist; **nothing reads annotations yet** |
| Standing config | table exists; **unpopulated until Dan fills the worksheet** |

The correction ledger is the piece with the most upside and the least code.
When a marked-up PDF returns to Drive, feed it to Claude with vision, classify
each annotation as quantity / rate / line, and write a row. Quantity changed
means the extractor misheard. Rate changed means the card is drifting. A line
added or removed means the completeness engine mis-scoped it. Three failures,
three fixes — collapsing them into "the estimate was wrong" is how a feedback
loop stops teaching you anything.

---

## Switching transcription

One env var. `deepgram` uses Nova-3 with keyterm boosting, which is more
surgical on proper nouns than a Whisper prompt — worth trying if place names
keep coming back wrong.

```
TRANSCRIBE_PROVIDER=groq | openai | deepgram
```

The vocabulary hint in `lib/transcribe.ts` is not decoration. The first real
memo transcribed **"Pittsford" as "Pittsburgh"** — a local place name, wrong,
in the job address. Add terms as you hit them.
