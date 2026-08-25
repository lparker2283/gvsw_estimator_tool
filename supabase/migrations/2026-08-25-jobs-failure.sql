-- A submit that dies leaves the job at 'generating' and says nothing about why.
-- That happened four times in a row on the first real run: the pricing call
-- succeeded each time, a proposal number was consumed each time, and the render
-- then died with no trace anywhere in the database.
--
-- `failure` carries the stage and the unwrapped cause. `status` gains 'failed'
-- as a real terminal state so a stuck job can be told apart from one still
-- running.
alter table jobs add column if not exists failure text;
create index if not exists jobs_status_created_idx on jobs (status, created_at desc);
