-- GVSW estimator: job register, answers, and the correction ledger.

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  status          text not null default 'transcribed',
    -- transcribed -> awaiting_answers -> generating -> delivered -> corrected
  from_email      text,
  audio_url       text,
  transcript      text not null,
  category        text,                      -- chimney | brick | stone | ...
  extraction      jsonb not null default '{}'::jsonb,
  questions       jsonb not null default '[]'::jsonb,
  answers         jsonb not null default '{}'::jsonb,
  job_spec        jsonb,                     -- the priced job.json
  token           text unique not null,      -- signed, used in /q/<token>
  delivered_at    timestamptz
);

create index on jobs (status);
create index on jobs (created_at desc);

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
