drop policy if exists "Admins can upload private gallery files" on storage.objects;

create policy "Admins can upload private gallery files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-galleries'
  and public.is_gallery_admin()
  and (
    name ~ '^albums/[0-9a-f-]+/(originals|web|thumbs|watermarked|web-watermarked|thumbs-watermarked)/[^/]+$'
    or name = 'admin-profiles/' || auth.uid()::text || '/avatar.webp'
  )
);
