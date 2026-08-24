-- inbound_failures arrived after the note that said "RLS on all three tables",
-- and was the one table left without it. It carries from_email, email_id,
-- attachment_id and a failure detail — client data on every count.
--
-- Policy-less RLS is the intended state here, not an oversight: the server only
-- ever talks to this database with the service_role key, which bypasses RLS, so
-- no policy means the publishable key can read nothing.
alter table inbound_failures enable row level security;
