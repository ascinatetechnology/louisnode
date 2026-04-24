alter table users
add column if not exists profile_visibility_mode text not null default 'everyone';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_profile_visibility_mode_check'
  ) then
    alter table users
    add constraint users_profile_visibility_mode_check
    check (profile_visibility_mode in ('everyone', 'liked', 'hidden'));
  end if;
end $$;
