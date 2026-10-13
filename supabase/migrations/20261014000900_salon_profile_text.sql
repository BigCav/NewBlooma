-- Public salon page copy: optional headline, intro line and about text.
alter table salons add column if not exists headline text, add column if not exists intro text, add column if not exists about text;
