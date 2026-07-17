create extension if not exists pgcrypto;

create table if not exists public.gallery_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_gallery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gallery_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date,
  location text,
  description text,
  cover_path text,
  access_code_hash text not null,
  downloads_enabled boolean not null default false,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  expires_at timestamptz,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint albums_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint albums_session_version_positive check (session_version > 0)
);

create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  caption text,
  sort_order integer not null default 0,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint album_photos_storage_path_format check (storage_path ~ '^albums/[0-9a-f-]+/(originals|web|thumbs)/[^/]+$'),
  constraint album_photos_dimensions_positive check ((width is null or width > 0) and (height is null or height > 0))
);

create table if not exists public.album_sessions (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  token_hash text not null unique,
  session_version integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create table if not exists public.album_access_attempts (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.albums(id) on delete cascade,
  slug text not null,
  ip_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists albums_slug_idx on public.albums(slug);
create index if not exists albums_active_expiry_idx on public.albums(is_active, expires_at);
create index if not exists album_photos_album_sort_idx on public.album_photos(album_id, sort_order, created_at);
create index if not exists album_sessions_lookup_idx on public.album_sessions(token_hash, expires_at);
create index if not exists album_sessions_cleanup_idx on public.album_sessions(expires_at);
create index if not exists album_access_attempts_rate_idx on public.album_access_attempts(slug, ip_hash, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists albums_touch_updated_at on public.albums;
create trigger albums_touch_updated_at
before update on public.albums
for each row
execute function public.touch_updated_at();

create or replace function public.cleanup_expired_gallery_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.album_sessions where expires_at < now();
  delete from public.album_access_attempts where created_at < now() - interval '7 days';
$$;

alter table public.gallery_admins enable row level security;
alter table public.albums enable row level security;
alter table public.album_photos enable row level security;
alter table public.album_sessions enable row level security;
alter table public.album_access_attempts enable row level security;

drop policy if exists "Admins can read gallery admins" on public.gallery_admins;
create policy "Admins can read gallery admins"
on public.gallery_admins for select
to authenticated
using (public.is_gallery_admin());

drop policy if exists "Admins can manage albums" on public.albums;
create policy "Admins can manage albums"
on public.albums for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "Admins can manage album photos" on public.album_photos;
create policy "Admins can manage album photos"
on public.album_photos for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "Admins can read album sessions" on public.album_sessions;
create policy "Admins can read album sessions"
on public.album_sessions for select
to authenticated
using (public.is_gallery_admin());

drop policy if exists "Admins can read access attempts" on public.album_access_attempts;
create policy "Admins can read access attempts"
on public.album_access_attempts for select
to authenticated
using (public.is_gallery_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-galleries',
  'private-galleries',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload private gallery files" on storage.objects;
create policy "Admins can upload private gallery files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
  and name ~ '^albums/[0-9a-f-]+/(originals|web|thumbs)/[^/]+$'
);

drop policy if exists "Admins can read private gallery files" on storage.objects;
create policy "Admins can read private gallery files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
);

drop policy if exists "Admins can update private gallery files" on storage.objects;
create policy "Admins can update private gallery files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
)
with check (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
);

drop policy if exists "Admins can delete private gallery files" on storage.objects;
create policy "Admins can delete private gallery files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
);
