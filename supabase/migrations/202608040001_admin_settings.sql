create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  role_label text not null default 'Administradora',
  bio text not null default '',
  avatar_path text,
  phone text,
  timezone text not null default 'Europe/Lisbon',
  locale text not null default 'pt-PT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_full_name_length check (char_length(trim(full_name)) between 2 and 80),
  constraint admin_profiles_role_length check (char_length(trim(role_label)) between 2 and 60),
  constraint admin_profiles_bio_length check (char_length(bio) <= 280),
  constraint admin_profiles_phone_length check (phone is null or char_length(phone) <= 32),
  constraint admin_profiles_timezone_length check (char_length(timezone) between 3 and 64),
  constraint admin_profiles_locale_supported check (locale = 'pt-PT'),
  constraint admin_profiles_avatar_path check (
    avatar_path is null
    or avatar_path ~ '^avatars/[0-9a-f-]+/[0-9a-f-]+\.webp$'
    or avatar_path ~ '^admin-profiles/[0-9a-f-]+/avatar\.webp$'
  )
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  date_format text not null default 'dd/mm/yyyy',
  default_gallery_expiry_days integer,
  default_downloads_enabled boolean not null default true,
  default_watermark_enabled boolean not null default true,
  default_sales_enabled boolean not null default false,
  default_currency text not null default 'EUR',
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_date_format_supported check (date_format = 'dd/mm/yyyy'),
  constraint user_preferences_expiry_range check (
    default_gallery_expiry_days is null
    or default_gallery_expiry_days between 1 and 365
  ),
  constraint user_preferences_currency_supported check (default_currency = 'EUR'),
  constraint user_preferences_notifications_object check (jsonb_typeof(notification_preferences) = 'object')
);

create index if not exists admin_profiles_user_idx on public.admin_profiles(user_id);
create index if not exists user_preferences_user_idx on public.user_preferences(user_id);

drop trigger if exists admin_profiles_touch_updated_at on public.admin_profiles;
create trigger admin_profiles_touch_updated_at
before update on public.admin_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute function public.touch_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists "Administrators manage their own profile" on public.admin_profiles;
create policy "Administrators manage their own profile"
on public.admin_profiles for all
to authenticated
using (user_id = auth.uid() and public.is_gallery_admin())
with check (user_id = auth.uid() and public.is_gallery_admin());

drop policy if exists "Administrators manage their own preferences" on public.user_preferences;
create policy "Administrators manage their own preferences"
on public.user_preferences for all
to authenticated
using (user_id = auth.uid() and public.is_gallery_admin())
with check (user_id = auth.uid() and public.is_gallery_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-avatars',
  'admin-avatars',
  false,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Administrators upload their own avatars" on storage.objects;
create policy "Administrators upload their own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'admin-avatars'
  and public.is_gallery_admin()
  and name like 'avatars/' || auth.uid()::text || '/%'
  and name ~ '^avatars/[0-9a-f-]+/[0-9a-f-]+\.webp$'
);

drop policy if exists "Administrators read their own avatars" on storage.objects;
create policy "Administrators read their own avatars"
on storage.objects for select
to authenticated
using (
  bucket_id = 'admin-avatars'
  and public.is_gallery_admin()
  and name like 'avatars/' || auth.uid()::text || '/%'
);

drop policy if exists "Administrators update their own avatars" on storage.objects;
create policy "Administrators update their own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'admin-avatars'
  and public.is_gallery_admin()
  and name like 'avatars/' || auth.uid()::text || '/%'
)
with check (
  bucket_id = 'admin-avatars'
  and public.is_gallery_admin()
  and name like 'avatars/' || auth.uid()::text || '/%'
  and name ~ '^avatars/[0-9a-f-]+/[0-9a-f-]+\.webp$'
);

drop policy if exists "Administrators delete their own avatars" on storage.objects;
create policy "Administrators delete their own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'admin-avatars'
  and public.is_gallery_admin()
  and name like 'avatars/' || auth.uid()::text || '/%'
);
