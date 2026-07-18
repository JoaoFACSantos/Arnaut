alter table public.albums
  add column if not exists public_id uuid not null default gen_random_uuid(),
  add column if not exists event_type text not null default 'Outro',
  add column if not exists guest_message text,
  add column if not exists access_code_lookup text,
  add column if not exists access_code_last_four text,
  add column if not exists access_code_created_at timestamptz,
  add column if not exists download_all_enabled boolean not null default false,
  add column if not exists status text not null default 'draft';

alter table public.album_access_attempts
  add column if not exists code_lookup text,
  add column if not exists device_hash text;

create unique index if not exists albums_public_id_key on public.albums(public_id);
create unique index if not exists albums_access_code_lookup_key
  on public.albums(access_code_lookup)
  where access_code_lookup is not null;

create index if not exists albums_status_idx on public.albums(status);
create index if not exists albums_event_type_idx on public.albums(event_type);
create index if not exists album_access_attempts_lookup_rate_idx
  on public.album_access_attempts(code_lookup, ip_hash, created_at);

alter table public.albums
  drop constraint if exists albums_status_check;

alter table public.albums
  add constraint albums_status_check
  check (status in ('draft', 'active', 'disabled', 'expired', 'archived'));

update public.albums
set status = case
  when is_archived then 'archived'
  when is_active = false then 'disabled'
  when expires_at is not null and expires_at <= now() then 'expired'
  else 'active'
end
where status = 'draft';
