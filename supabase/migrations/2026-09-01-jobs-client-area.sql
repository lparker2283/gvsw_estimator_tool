-- Who the job is for and where it is, as Dan typed them on the first screen of
-- the question page.
--
-- Typed, not extracted. The first real memo transcribed "Pittsford" as
-- "Pittsburgh", and a place name the tool inferred is a place name it can carry
-- all the way into the pricing — wrong county, wrong frost line, wrong tax. So
-- the page now asks, prefilled with what was heard, and what he confirms is
-- what gets stored here and priced against. The extractor's guess stays in
-- extraction.job and only ever prefills the screen.
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT WRITES IT. The submit route updates
-- these columns on every answer set; a database without them fails the update
-- before pricing starts, and the job is left at 'awaiting_answers'.
alter table jobs add column if not exists client text;
alter table jobs add column if not exists area   text;
