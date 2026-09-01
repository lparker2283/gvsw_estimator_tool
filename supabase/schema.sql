-- GVSW estimator: job register, answers, and the correction ledger.

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'transcribed',
    -- transcribed -> awaiting_answers -> generating -> delivered -> corrected
    -- generating -> failed  (see the failure column)
  from_email      text,
  audio_url       text,
  transcript      text not null,
  category        text,                      -- chimney | brick | stone | ...
  extraction      jsonb not null default '{}'::jsonb,
  questions       jsonb not null default '[]'::jsonb,
  answers         jsonb not null default '{}'::jsonb,
  job_spec        jsonb,                     -- the priced job.json
  token           text unique not null,      -- signed, used in /q/<token>
  event_id        text,                      -- svix-id of the delivery that made this row
  delivered_at    timestamptz
);

create index on jobs (status);
create index on jobs (created_at desc);

-- One job per inbound delivery. Svix reuses its message id across retries, so a
-- retried memo collides here instead of transcribing, pricing and emailing twice.
-- Nullable on purpose: rows made by hand carry no event, and Postgres lets nulls
-- repeat under a unique index.
create unique index jobs_event_id_key on jobs (event_id);

-- Deliveries that arrived, verified, and then failed to become a job.
--
-- A failed memo used to leave nothing behind but a 500 and a log line, and the
-- 500 is what got the webhook disabled: Svix retries a failing endpoint, and a
-- reason that a retry cannot fix — a bad key, a malformed value — fails every
-- time until Resend switches the endpoint off. The row is what makes it safe to
-- stop retrying: the memo is still recoverable by hand from email_id and
-- attachment_id, so the endpoint can answer 200 and stay alive.
create table inbound_failures (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  event_id        text unique,    -- svix-id; a retry updates this row, never adds one
  from_email      text,
  filename        text,
  email_id        text,           -- with attachment_id, enough to re-fetch the audio
  attachment_id   text,
  stage           text not null,  -- fetch audio | transcribe | extract | create job | ...
  detail          text not null,  -- redacted, cause chain unwrapped
  retryable       boolean not null default false,
  attempts        int not null default 1
);

create index on inbound_failures (created_at desc);

-- Every edit Dan makes, classified by type. Different failures, different fixes.
create table corrections (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  created_at      timestamptz not null default now(),
  source          text not null default 'annotation',   -- annotation | reply | manual
  kind            text not null,
    -- quantity  -> the tool mis-heard the memo        -> fix extraction
    -- rate      -> the card is drifting               -> fix the rate card
    -- line      -> the tool mis-scoped the job        -> fix the completeness engine
    -- other
  line_ref        text,
  tool_value      text,
  dan_value       text,
  note            text
);

create index on corrections (kind);
create index on corrections (job_id);

-- Standing config Dan supplies once. One row.
create table config (
  id                 int primary key default 1,
  warranty_term      text,
  deposit_split      text,
  progress_split     text,
  suppliers          jsonb,
  license_number     text,
  tax_rate_pct       numeric,
  next_proposal_no   int not null default 1,
  check (id = 1)
);
insert into config (id) values (1) on conflict do nothing;

-- Applied separately as supabase/migrations/2026-08-24-corrections-event-id.sql
-- for a database that already exists; included here so a fresh one is correct.
alter table corrections add column if not exists event_id text;
alter table corrections add column if not exists confidence text;
create unique index if not exists corrections_event_id_key on corrections (event_id);
create index if not exists corrections_created_at_idx on corrections (created_at desc);

-- Applied separately as supabase/migrations/2026-08-25-jobs-failure.sql for a
-- database that already exists; included here so a fresh one is correct.
alter table jobs add column if not exists failure text;
create index if not exists jobs_status_created_idx on jobs (status, created_at desc);

-- Applied separately as supabase/migrations/2026-09-01-jobs-client-area.sql
-- for a database that already exists; included here so a fresh one is correct.
--
-- Who the job is for and where it is, as Dan typed them on the first screen of
-- the question page. Typed, not extracted: the first real memo came back with
-- "Pittsburgh" for Pittsford, and a place name the tool inferred is a place
-- name it can get wrong. These are the confirmed values; the extractor's guess
-- lives in extraction.job and only ever prefills the screen.
alter table jobs add column if not exists client text;
alter table jobs add column if not exists area   text;

-- Every table holds client data, and the server only ever reaches this database
-- with the service_role key, which bypasses RLS. So RLS on with no policy is the
-- intended state: the publishable key can then read nothing. Supabase's linter
-- reports policy-less RLS as an INFO notice — that notice is the desired state.
--
-- This was applied by hand to jobs, corrections and config when they were made,
-- and was missing from schema.sql, so inbound_failures — added later — came up
-- without it. Stated here instead, where a new table cannot quietly skip it.
alter table jobs              enable row level security;
alter table inbound_failures  enable row level security;
alter table corrections       enable row level security;
alter table config            enable row level security;
