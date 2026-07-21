alter table public.album_photos
  add column if not exists web_path text,
  add column if not exists watermark_mode text not null default 'inherit';

alter table public.album_photos
  drop constraint if exists album_photos_watermark_mode_valid,
  add constraint album_photos_watermark_mode_valid
  check (watermark_mode in ('inherit', 'enabled', 'disabled'));

alter table public.album_photos
  drop constraint if exists album_photos_web_path_format,
  add constraint album_photos_web_path_format
  check (web_path is null or web_path ~ '^albums/[0-9a-f-]+/web/[^/]+\.webp$');

alter table public.album_photos
  drop constraint if exists album_photos_watermarked_path_format,
  add constraint album_photos_watermarked_path_format
  check (watermarked_path is null or watermarked_path ~ '^albums/[0-9a-f-]+/(watermarked|web-watermarked)/[^/]+\.webp$');

alter table public.album_photos
  drop constraint if exists album_photos_thumbnail_path_format,
  add constraint album_photos_thumbnail_path_format
  check (thumbnail_path is null or thumbnail_path ~ '^albums/[0-9a-f-]+/(thumbs|thumbs-watermarked)/[^/]+\.webp$');

alter table public.album_photos
  drop constraint if exists album_photos_storage_path_format,
  add constraint album_photos_storage_path_format
  check (storage_path ~ '^albums/[0-9a-f-]+/(originals|web|thumbs|watermarked|web-watermarked|thumbs-watermarked)/[^/]+$');

create index if not exists album_photos_watermark_mode_idx
on public.album_photos(album_id, watermark_mode, processing_status);

drop policy if exists "Admins can upload private gallery files" on storage.objects;
create policy "Admins can upload private gallery files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
  and name ~ '^albums/[0-9a-f-]+/(originals|web|thumbs|watermarked|web-watermarked|thumbs-watermarked)/[^/]+$'
);
