alter table users
add column if not exists location_enabled boolean not null default true;
