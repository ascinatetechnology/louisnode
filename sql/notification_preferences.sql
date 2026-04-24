alter table users
add column if not exists notify_new_matches boolean not null default true;

alter table users
add column if not exists notify_messages boolean not null default true;

alter table users
add column if not exists notify_likes boolean not null default true;

alter table notifications
add column if not exists metadata jsonb not null default '{}'::jsonb;
