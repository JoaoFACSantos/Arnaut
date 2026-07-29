update public.albums
set watermark_version = watermark_version + 1
where watermark_enabled = true;

update public.album_photos as photo
set
  processing_status = 'pending',
  processing_error = null
from public.albums as album
where album.id = photo.album_id
  and album.watermark_enabled = true
  and coalesce(photo.original_path, photo.storage_path) is not null;

insert into public.image_processing_jobs (
  album_id,
  photo_id,
  job_type,
  status,
  attempts,
  processing_error,
  locked_at,
  locked_by,
  finished_at
)
select
  photo.album_id,
  photo.id,
  'watermark',
  'pending',
  0,
  null,
  null,
  null,
  null
from public.album_photos as photo
join public.albums as album on album.id = photo.album_id
where album.watermark_enabled = true
  and coalesce(photo.original_path, photo.storage_path) is not null
on conflict (photo_id, job_type) do update
set
  status = 'pending',
  attempts = 0,
  processing_error = null,
  locked_at = null,
  locked_by = null,
  finished_at = null,
  updated_at = now();
