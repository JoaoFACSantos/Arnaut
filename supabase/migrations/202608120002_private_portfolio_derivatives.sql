-- Keep portfolio derivatives private at bucket level. Public visitors may only
-- request signed URLs for files referenced by an explicitly published record.
update storage.buckets
set public = false
where id = 'public-portfolio';

drop policy if exists "Anyone reads published portfolio derivatives" on storage.objects;

create policy "Anyone reads published portfolio derivatives" on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'public-portfolio'
  and exists (
    select 1
    from public.portfolio_photos photo
    where photo.is_published = true
      and (photo.web_path = storage.objects.name or photo.thumbnail_path = storage.objects.name)
  )
);
