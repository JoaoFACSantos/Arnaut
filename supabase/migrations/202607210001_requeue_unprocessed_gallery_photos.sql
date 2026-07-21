-- Recover photographs uploaded before the simplified watermark pipeline was
-- fully deployed. They already exist in private Storage, so only the derived
-- web/thumbnail variants need to be generated again.
update public.album_photos
set
  processing_status = 'pending',
  processing_error = null
where coalesce(original_path, storage_path) is not null
  and web_path is null;

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
where coalesce(photo.original_path, photo.storage_path) is not null
  and photo.web_path is null
on conflict (photo_id, job_type) do update
set
  status = 'pending',
  attempts = 0,
  processing_error = null,
  locked_at = null,
  locked_by = null,
  finished_at = null,
  updated_at = now();
