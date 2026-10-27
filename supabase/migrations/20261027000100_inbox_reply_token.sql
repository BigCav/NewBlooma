alter table inbox_items add column if not exists reply_token text not null default encode(gen_random_bytes(18), 'hex');
create unique index if not exists inbox_items_reply_token_idx on inbox_items (reply_token);
