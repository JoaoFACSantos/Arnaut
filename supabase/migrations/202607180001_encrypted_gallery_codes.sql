alter table public.albums
  add column if not exists access_code_encrypted text;

create or replace function public.cleanup_abandoned_gallery_drafts()
returns void
language sql
security definer
set search_path = public
as $$
  update public.albums
  set is_archived = true,
      status = 'archived'
  where status = 'draft'
    and created_at < now() - interval '24 hours'
    and not exists (
      select 1
      from public.album_photos
      where album_photos.album_id = albums.id
    );
$$;
