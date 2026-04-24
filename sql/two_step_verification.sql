alter table users
add column if not exists two_step_enabled boolean not null default false;
