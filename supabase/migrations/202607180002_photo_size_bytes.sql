alter table public.album_photos
  add column if not exists size_bytes bigint;

alter table public.album_photos
  drop constraint if exists album_photos_size_bytes_positive;

alter table public.album_photos
  add constraint album_photos_size_bytes_positive
  check (size_bytes is null or size_bytes >= 0)
  not valid;

alter table public.album_photos
  validate constraint album_photos_size_bytes_positive;
