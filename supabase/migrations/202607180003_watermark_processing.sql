alter table public.albums
  add column if not exists watermark_enabled boolean not null default true,
  add column if not exists watermark_position text not null default 'bottom-center',
  add column if not exists watermark_opacity numeric(4, 3) not null default 0.300,
  add column if not exists watermark_scale numeric(4, 3) not null default 0.200,
  add column if not exists watermark_original_downloads boolean not null default false,
  add column if not exists watermark_version integer not null default 1;

alter table public.albums
  drop constraint if exists albums_watermark_position_valid,
  add constraint albums_watermark_position_valid
  check (watermark_position in ('bottom-center', 'bottom-right', 'bottom-left', 'center'));

alter table public.albums
  drop constraint if exists albums_watermark_opacity_valid,
  add constraint albums_watermark_opacity_valid
  check (watermark_opacity >= 0 and watermark_opacity <= 1);

alter table public.albums
  drop constraint if exists albums_watermark_scale_valid,
  add constraint albums_watermark_scale_valid
  check (watermark_scale >= 0.08 and watermark_scale <= 0.45);

alter table public.albums
  drop constraint if exists albums_watermark_version_positive,
  add constraint albums_watermark_version_positive
  check (watermark_version > 0);

alter table public.album_photos
  add column if not exists original_path text,
  add column if not exists watermarked_path text,
  add column if not exists thumbnail_path text,
  add column if not exists processing_status text not null default 'pending',
  add column if not exists processing_error text,
  add column if not exists format text,
  add column if not exists processed_at timestamptz,
  add column if not exists watermark_version integer not null default 0;

update public.album_photos
set original_path = coalesce(original_path, storage_path)
where original_path is null;

update public.album_photos
set processing_status = case
  when watermarked_path is not null and thumbnail_path is not null then 'ready'
  else processing_status
end;

alter table public.album_photos
  alter column original_path set not null;

alter table public.album_photos
  drop constraint if exists album_photos_processing_status_valid,
  add constraint album_photos_processing_status_valid
  check (processing_status in ('pending', 'processing', 'ready', 'failed'));

alter table public.album_photos
  drop constraint if exists album_photos_original_path_format,
  add constraint album_photos_original_path_format
  check (original_path ~ '^albums/[0-9a-f-]+/originals/[^/]+$');

alter table public.album_photos
  drop constraint if exists album_photos_watermarked_path_format,
  add constraint album_photos_watermarked_path_format
  check (watermarked_path is null or watermarked_path ~ '^albums/[0-9a-f-]+/web-watermarked/[^/]+\.webp$');

alter table public.album_photos
  drop constraint if exists album_photos_thumbnail_path_format,
  add constraint album_photos_thumbnail_path_format
  check (thumbnail_path is null or thumbnail_path ~ '^albums/[0-9a-f-]+/thumbs-watermarked/[^/]+\.webp$');

alter table public.album_photos
  drop constraint if exists album_photos_storage_path_format;

alter table public.album_photos
  add constraint album_photos_storage_path_format
  check (storage_path ~ '^albums/[0-9a-f-]+/(originals|web|thumbs|web-watermarked|thumbs-watermarked)/[^/]+$');

alter table public.album_photos
  drop constraint if exists album_photos_watermark_version_nonnegative,
  add constraint album_photos_watermark_version_nonnegative
  check (watermark_version >= 0);

create table if not exists public.image_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  photo_id uuid not null references public.album_photos(id) on delete cascade,
  job_type text not null default 'watermark',
  status text not null default 'pending',
  attempts integer not null default 0,
  processing_error text,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint image_processing_jobs_type_valid check (job_type in ('watermark')),
  constraint image_processing_jobs_status_valid check (status in ('pending', 'processing', 'ready', 'failed')),
  constraint image_processing_jobs_attempts_nonnegative check (attempts >= 0)
);

drop index if exists image_processing_jobs_unique_active;
create unique index if not exists image_processing_jobs_unique_photo_type
on public.image_processing_jobs(photo_id, job_type);

create index if not exists album_photos_processing_idx
on public.album_photos(album_id, processing_status, watermark_version);

create index if not exists image_processing_jobs_queue_idx
on public.image_processing_jobs(status, created_at);

alter table public.image_processing_jobs enable row level security;

drop policy if exists "Admins can manage image processing jobs" on public.image_processing_jobs;
create policy "Admins can manage image processing jobs"
on public.image_processing_jobs for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "Admins can upload private gallery files" on storage.objects;
create policy "Admins can upload private gallery files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
  and name ~ '^albums/[0-9a-f-]+/(originals|web|thumbs|web-watermarked|thumbs-watermarked)/[^/]+$'
);
