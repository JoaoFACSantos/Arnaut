import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const supabase = createServiceClient();
  const admin = await requireAdmin(request, supabase);
  if (!admin.ok) return admin.response;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');

  try {
    if (action === 'list') {
      const [{ data: photos, error }, { data: categories, error: categoryError }, { data: settings }] = await Promise.all([
        supabase.from('portfolio_photos').select('*, portfolio_categories(id, slug, label, sort_order)').order('sort_order').order('created_at'),
        supabase.from('portfolio_categories').select('*').eq('enabled', true).order('sort_order'),
        supabase.from('portfolio_settings').select('max_recent').eq('id', true).maybeSingle(),
      ]);
      if (error) throw error;
      if (categoryError) throw categoryError;
      const hydrated = await Promise.all((photos || []).map(async (photo) => {
        const thumbnailPath = photo.thumbnail_path || photo.web_path;
        if (!thumbnailPath) return { ...photo, thumbnail_url: photo.legacy_public_url, web_url: photo.legacy_public_url };
        const [thumbnail, web] = await Promise.all([
          supabase.storage.from('public-portfolio').createSignedUrl(thumbnailPath, 60 * 60),
          supabase.storage.from('public-portfolio').createSignedUrl(photo.web_path || thumbnailPath, 60 * 60),
        ]);
        return {
          ...photo,
          thumbnail_url: thumbnail.data?.signedUrl || photo.legacy_public_url,
          web_url: web.data?.signedUrl || photo.legacy_public_url,
        };
      }));
      return json({ photos: hydrated, categories: categories || [], maxRecent: settings?.max_recent || 8 });
    }
    if (action === 'save') {
      const photo = body.photo || {};
      const { error } = await supabase.from('portfolio_photos').update({
        category_id: photo.categoryId,
        internal_title: String(photo.internalTitle || '').trim().slice(0, 120) || null,
        alt_text: String(photo.altText || '').slice(0, 280),
        focal_x: Math.min(100, Math.max(0, Number(photo.focalX ?? 50))),
        focal_y: Math.min(100, Math.max(0, Number(photo.focalY ?? 50))),
        is_published: Boolean(photo.isPublished),
        is_featured: Boolean(photo.isFeatured),
      }).eq('id', photo.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'reorder') {
      const items = Array.isArray(body.items) ? body.items : [];
      for (const [index, item] of items.entries()) {
        const { error } = await supabase.from('portfolio_photos').update({ sort_order: (index + 1) * 10 }).eq('id', item.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }
    if (action === 'create-record') {
      const id = crypto.randomUUID();
      const source = body.source || {};
      const { data: last } = await supabase.from('portfolio_photos').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase.from('portfolio_photos').insert({
        id, category_id: source.categoryId, source_photo_id: source.sourcePhotoId || null, source_gallery_id: source.sourceGalleryId || null,
        web_path: `portfolio/${id}/web.webp`, thumbnail_path: `portfolio/${id}/thumb.webp`, alt_text: String(source.altText || '').slice(0, 280),
        internal_title: String(source.internalTitle || '').trim().slice(0, 120) || null, is_featured: Boolean(source.isFeatured),
        is_published: Boolean(source.isPublished), sort_order: Number(last?.sort_order || 0) + 10, width: Number(source.width) || null,
        height: Number(source.height) || null, size_bytes: Number(source.sizeBytes) || null, created_by: admin.user.id,
      }).select('id, web_path, thumbnail_path').single();
      if (error) throw error;
      return json({ photo: data });
    }
    if (action === 'delete') {
      const { data: photo, error } = await supabase.from('portfolio_photos').select('web_path, thumbnail_path').eq('id', body.photoId).single();
      if (error) throw error;
      const paths = [photo.web_path, photo.thumbnail_path].filter(Boolean);
      if (paths.length) await supabase.storage.from('public-portfolio').remove(paths);
      const deleted = await supabase.from('portfolio_photos').delete().eq('id', body.photoId);
      if (deleted.error) throw deleted.error;
      return json({ ok: true });
    }
    if (action === 'prepare-replace') {
      const photoId = String(body.photoId || '');
      const webPath = `portfolio/${photoId}/web.webp`;
      const thumbnailPath = `portfolio/${photoId}/thumb.webp`;
      const { error } = await supabase.from('portfolio_photos').update({ web_path: webPath, thumbnail_path: thumbnailPath }).eq('id', photoId);
      if (error) throw error;
      return json({ id: photoId, web_path: webPath, thumbnail_path: thumbnailPath });
    }
    if (action === 'finalize-replace') {
      const { error } = await supabase.from('portfolio_photos').update({
        legacy_public_url: null,
        width: Number(body.width) || null,
        height: Number(body.height) || null,
        size_bytes: Number(body.sizeBytes) || null,
        updated_at: new Date().toISOString(),
      }).eq('id', body.photoId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'albums') {
      const { data, error } = await supabase.from('albums').select('id, title, event_date, location').order('created_at', { ascending: false });
      if (error) throw error;
      return json({ albums: data || [] });
    }
    if (action === 'album-photos') {
      const { data, error } = await supabase.from('album_photos').select('id, album_id, filename, caption, thumbnail_path, web_path, storage_path, original_path, width, height, size_bytes').eq('album_id', body.albumId).order('sort_order');
      if (error) throw error;
      const photos = await Promise.all((data || []).map(async (photo) => {
        const sourcePath = photo.web_path || photo.original_path || photo.storage_path;
        const previewPath = photo.thumbnail_path || sourcePath;
        const [source, preview] = await Promise.all([
          supabase.storage.from('private-galleries').createSignedUrl(sourcePath, 15 * 60),
          supabase.storage.from('private-galleries').createSignedUrl(previewPath, 15 * 60),
        ]);
        return { ...photo, source_url: source.data?.signedUrl, preview_url: preview.data?.signedUrl };
      }));
      return json({ photos });
    }
    if (action === 'setting') {
      const maxRecent = Math.min(24, Math.max(1, Number(body.maxRecent || 8)));
      const { error } = await supabase.from('portfolio_settings').upsert({ id: true, max_recent: maxRecent });
      if (error) throw error;
      return json({ maxRecent });
    }
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    console.error('admin-portfolio', action, error);
    return json({ error: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }, 500);
  }
});
