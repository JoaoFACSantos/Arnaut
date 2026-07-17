import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';
import {
  BUCKET,
  buildStoragePath,
  corsHeaders,
  getEnv,
  hashAccessCode,
  isValidSlug,
  json,
  normalizeSlug,
  readJson,
  sanitizeText,
} from '../_shared/security.js';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabase = createServiceClient();
  const admin = await requireAdmin(request, supabase);
  if (!admin.ok) {
    return json({ error: admin.response.status === 403 ? 'Acesso restrito à administradora.' : 'Sessão inválida.' }, admin.response.status);
  }

  const body = await readJson(request);
  const action = String(body.action || '');

  try {
    if (action === 'list') {
      const { data, error } = await supabase
        .from('albums')
        .select('id, slug, title, event_date, location, description, cover_path, downloads_enabled, is_active, is_archived, expires_at, session_version, created_at, updated_at, album_photos(id, storage_path, filename, caption, sort_order, width, height, created_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json({ albums: data || [] });
    }

    if (action === 'save-album') {
      const album = body.album || {};
      const id = album.id || null;
      const slug = normalizeSlug(album.slug || album.title);
      const accessCode = String(album.accessCode || '').trim();

      if (!isValidSlug(slug)) return json({ error: 'Slug inválido.' }, 400);
      if (!id && accessCode.length < 4) return json({ error: 'Defina um código com pelo menos 4 caracteres.' }, 400);

      const payload: Record<string, unknown> = {
        slug,
        title: sanitizeText(album.title, 160),
        event_date: album.eventDate || null,
        location: sanitizeText(album.location, 180) || null,
        description: sanitizeText(album.description, 1200) || null,
        cover_path: album.coverPath || null,
        downloads_enabled: Boolean(album.downloadsEnabled),
        is_active: album.isActive !== false,
        is_archived: Boolean(album.isArchived),
        expires_at: album.expiresAt || null,
      };

      if (!payload.title) return json({ error: 'O nome do evento é obrigatório.' }, 400);

      if (accessCode) {
        payload.access_code_hash = await hashAccessCode(accessCode, getEnv('ACCESS_CODE_PEPPER'));
      }

      if (id) {
        const { data: current } = await supabase
          .from('albums')
          .select('session_version')
          .eq('id', id)
          .maybeSingle();
        if (accessCode) payload.session_version = (current?.session_version || 1) + 1;

        const { data, error } = await supabase
          .from('albums')
          .update(payload)
          .eq('id', id)
          .select('id, slug, title, event_date, location, description, cover_path, downloads_enabled, is_active, is_archived, expires_at, session_version, created_at, updated_at')
          .single();
        if (error) throw error;
        return json({ album: data });
      }

      payload.created_by = admin.user.id;
      const { data, error } = await supabase
        .from('albums')
        .insert(payload)
        .select('id, slug, title, event_date, location, description, cover_path, downloads_enabled, is_active, is_archived, expires_at, session_version, created_at, updated_at')
        .single();
      if (error) throw error;
      return json({ album: data });
    }

    if (action === 'create-storage-path') {
      const albumId = String(body.albumId || '');
      const filename = sanitizeText(body.filename, 240);
      const path = buildStoragePath(albumId, filename, 'originals');
      return json({ path });
    }

    if (action === 'register-photo') {
      const photo = body.photo || {};
      const { data, error } = await supabase
        .from('album_photos')
        .insert({
          album_id: photo.albumId,
          storage_path: photo.storagePath,
          filename: sanitizeText(photo.filename, 240),
          caption: sanitizeText(photo.caption, 300) || null,
          sort_order: Number(photo.sortOrder || 0),
          width: photo.width || null,
          height: photo.height || null,
        })
        .select('id, storage_path, filename, caption, sort_order, width, height, created_at')
        .single();
      if (error) throw error;
      return json({ photo: data });
    }

    if (action === 'delete-photo') {
      const photoId = String(body.photoId || '');
      const { data: photo, error: findError } = await supabase
        .from('album_photos')
        .select('id, storage_path')
        .eq('id', photoId)
        .maybeSingle();
      if (findError) throw findError;
      if (photo?.storage_path) await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      await supabase.from('album_photos').delete().eq('id', photoId);
      return json({ ok: true });
    }

    if (action === 'reorder-photos') {
      const updates = Array.isArray(body.photos) ? body.photos : [];
      for (const item of updates) {
        await supabase.from('album_photos').update({ sort_order: Number(item.sortOrder || 0) }).eq('id', item.id);
      }
      return json({ ok: true });
    }

    if (action === 'delete-album') {
      const albumId = String(body.albumId || '');
      const { data: photos } = await supabase.from('album_photos').select('storage_path').eq('album_id', albumId);
      const paths = (photos || []).map((photo) => photo.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
      await supabase.from('albums').delete().eq('id', albumId);
      return json({ ok: true });
    }

    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) {
    console.error('admin-albums error', error?.message || error);
    return json({ error: 'Não foi possível concluir a operação.' }, 500);
  }
});
