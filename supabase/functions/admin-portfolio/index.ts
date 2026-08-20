import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
const slugify = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
        supabase.from('portfolio_categories').select('*').order('sort_order'),
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
      const counts = (categories || []).map((category) => ({
        categoryId: category.id,
        stored: (photos || []).filter((photo) => photo.category_id === category.id).length,
        published: (photos || []).filter((photo) => photo.category_id === category.id && photo.is_published).length,
        selected: (photos || []).filter((photo) => photo.category_id === category.id && photo.is_published && photo.show_in_category).length,
      }));
      return json({
        photos: hydrated,
        categories: categories || [],
        counts,
        allSelected: (photos || []).filter((photo) => photo.is_published && photo.show_in_all).length,
        limits: { categories: 5, selection: 8 },
        maxRecent: Math.min(8, settings?.max_recent || 8),
      });
    }
    if (action === 'save') {
      const photo = body.photo || {};
      const { data: existing, error: existingError } = await supabase.from('portfolio_photos').select('category_id,show_in_all,show_in_category,all_sort_order,category_sort_order').eq('id', photo.id).single();
      if (existingError) throw existingError;
      const updates: Record<string, unknown> = {
        category_id: photo.categoryId,
        internal_title: String(photo.internalTitle || '').trim().slice(0, 120) || null,
        alt_text: String(photo.altText || '').slice(0, 280),
        focal_x: Math.min(100, Math.max(0, Number(photo.focalX ?? 50))),
        focal_y: Math.min(100, Math.max(0, Number(photo.focalY ?? 50))),
        is_published: Boolean(photo.isPublished),
        is_featured: Boolean(photo.isFeatured),
        show_in_all: Boolean(photo.showInAll),
        show_in_category: Boolean(photo.showInCategory),
      };
      if (photo.showInAll && (!existing.show_in_all || existing.all_sort_order == null)) {
        const { data: lastAll } = await supabase.from('portfolio_photos').select('all_sort_order').not('all_sort_order', 'is', null).order('all_sort_order', { ascending: false }).limit(1).maybeSingle();
        updates.all_sort_order = Number(lastAll?.all_sort_order || 0) + 10;
      }
      if (photo.showInCategory && (!existing.show_in_category || existing.category_id !== photo.categoryId || existing.category_sort_order == null)) {
        const { data: lastCategory } = await supabase.from('portfolio_photos').select('category_sort_order').eq('category_id', photo.categoryId).not('category_sort_order', 'is', null).order('category_sort_order', { ascending: false }).limit(1).maybeSingle();
        updates.category_sort_order = Number(lastCategory?.category_sort_order || 0) + 10;
      }
      const { error } = await supabase.from('portfolio_photos').update(updates).eq('id', photo.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'reorder') {
      const items = Array.isArray(body.items) ? body.items : [];
      const mode = String(body.mode || 'library');
      const orderColumn = mode === 'all' ? 'all_sort_order' : mode === 'category' ? 'category_sort_order' : 'sort_order';
      for (const [index, item] of items.entries()) {
        const { error } = await supabase.from('portfolio_photos').update({ [orderColumn]: (index + 1) * 10 }).eq('id', item.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }
    if (action === 'category-create') {
      const label = String(body.label || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      const slug = slugify(label);
      if (label.length < 2 || !slug) return json({ error: 'Indique um nome válido para a categoria.' }, 400);
      const { data: last } = await supabase.from('portfolio_categories').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await supabase.from('portfolio_categories').insert({ label, slug, sort_order: Number(last?.sort_order || 0) + 10, enabled: true }).select('*').single();
      if (error) throw error;
      return json({ category: data });
    }
    if (action === 'category-save') {
      const label = String(body.label || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      const updates: Record<string, unknown> = { enabled: Boolean(body.enabled) };
      if (label) { updates.label = label; updates.slug = slugify(label); }
      const { error } = await supabase.from('portfolio_categories').update(updates).eq('id', body.categoryId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'category-reorder') {
      const items = Array.isArray(body.items) ? body.items : [];
      for (const [index, item] of items.entries()) {
        const { error } = await supabase.from('portfolio_categories').update({ sort_order: (index + 1) * 10 }).eq('id', item.id);
        if (error) throw error;
      }
      return json({ ok: true });
    }
    if (action === 'category-delete') {
      const { count } = await supabase.from('portfolio_photos').select('id', { count: 'exact', head: true }).eq('category_id', body.categoryId);
      if (count) return json({ error: 'Mova ou elimine primeiro as fotografias desta categoria.' }, 409);
      const { error } = await supabase.from('portfolio_categories').delete().eq('id', body.categoryId);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'create-record') {
      const id = crypto.randomUUID();
      const source = body.source || {};
      const { data: last } = await supabase.from('portfolio_photos').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
      const [{ data: lastAll }, { data: lastCategory }] = await Promise.all([
        source.showInAll ? supabase.from('portfolio_photos').select('all_sort_order').not('all_sort_order', 'is', null).order('all_sort_order', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        source.showInCategory ? supabase.from('portfolio_photos').select('category_sort_order').eq('category_id', source.categoryId).not('category_sort_order', 'is', null).order('category_sort_order', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const { data, error } = await supabase.from('portfolio_photos').insert({
        id, category_id: source.categoryId, source_photo_id: source.sourcePhotoId || null, source_gallery_id: source.sourceGalleryId || null,
        web_path: `portfolio/${id}/web.webp`, thumbnail_path: `portfolio/${id}/thumb.webp`, alt_text: String(source.altText || '').slice(0, 280),
        internal_title: String(source.internalTitle || '').trim().slice(0, 120) || null, is_featured: Boolean(source.isFeatured),
        is_published: Boolean(source.isPublished), show_in_all: Boolean(source.showInAll), all_sort_order: source.showInAll ? Number(lastAll?.all_sort_order || 0) + 10 : null,
        show_in_category: Boolean(source.showInCategory), category_sort_order: source.showInCategory ? Number(lastCategory?.category_sort_order || 0) + 10 : null,
        sort_order: Number(last?.sort_order || 0) + 10, width: Number(source.width) || null,
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
      const maxRecent = Math.min(8, Math.max(1, Number(body.maxRecent || 8)));
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
