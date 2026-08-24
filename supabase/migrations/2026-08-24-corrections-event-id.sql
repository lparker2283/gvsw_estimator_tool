-- Corrections arrive through the same webhook as memos, and Svix retries.
-- Without an idempotency key a retried delivery re-reads the same marked-up
-- page and files every mark a second time, which quietly doubles the weight of
-- whatever Dan corrected — the one thing the ledger must not do.
--
-- Nullable on purpose: rows written by hand carry no event, and Postgres lets
-- nulls repeat under a unique index.
alter table corrections add column if not exists event_id text;
alter table corrections add column if not exists confidence text;
create unique index if not exists corrections_event_id_key on corrections (event_id);
create index if not exists corrections_created_at_idx on corrections (created_at desc);
