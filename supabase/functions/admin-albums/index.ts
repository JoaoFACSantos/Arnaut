import { createServiceClient, requireAdmin } from '../_shared/supabase.ts';
import {
  BUCKET,
  assertAllowedImage,
  buildStoragePath,
  corsHeaders,
  decryptGalleryCode,
  encryptGalleryCode,
  generateGalleryCode,
  getEnv,
  hashAccessCode,
  lookupAccessCode,
  isValidSlug,
  json,
  maskGalleryCode,
  normalizeSlug,
  normalizeGalleryCode,
  readJson,
  sanitizeText,
} from '../_shared/security.js';

const ADMIN_ALBUM_SELECT = 'id, public_id, slug, title, event_type, event_date, location, description, guest_message, cover_path, access_code_last_four, access_code_created_at, downloads_enabled, download_all_enabled, watermark_enabled, watermark_position, watermark_opacity, watermark_scale, watermark_original_downloads, watermark_version, status, is_active, is_archived, expires_at, session_version, created_at, updated_at';
const ADMIN_ALBUM_WITH_PHOTOS_SELECT = `${ADMIN_ALBUM_SELECT}, album_photos(id, storage_path, original_path, web_path, watermarked_path, thumbnail_path, watermark_mode, processing_status, processing_error, filename, caption, sort_order, width, height, format, size_bytes, processed_at, watermark_version, created_at)`;

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
        .select(ADMIN_ALBUM_WITH_PHOTOS_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const albumIds = (data || []).map((album) => album.id);
      const sessionsByAlbum = new Map<string, { count: number; lastAccessedAt: string | null }>();
      if (albumIds.length) {
        const { data: sessions, error: sessionError } = await supabase
          .from('album_sessions')
          .select('album_id, last_accessed_at')
          .in('album_id', albumIds)
          .gt('expires_at', new Date().toISOString());
        if (sessionError) throw sessionError;
        (sessions || []).forEach((session) => {
          const previous = sessionsByAlbum.get(session.album_id) || { count: 0, lastAccessedAt: null };
          const nextLastAccessedAt = !previous.lastAccessedAt || new Date(session.last_accessed_at).getTime() > new Date(previous.lastAccessedAt).getTime()
            ? session.last_accessed_at
            : previous.lastAccessedAt;
          sessionsByAlbum.set(session.album_id, { count: previous.count + 1, lastAccessedAt: nextLastAccessedAt });
        });
      }
      const albums = await Promise.all((data || []).map(async (album) => {
        let cover_url = null;
        if (album.cover_path) {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(album.cover_path, 10 * 60);
          cover_url = signed?.signedUrl || null;
        }
        return {
          ...album,
          cover_url,
          active_session_count: sessionsByAlbum.get(album.id)?.count || 0,
          last_session_at: sessionsByAlbum.get(album.id)?.lastAccessedAt || null,
          access_code_masked: album.access_code_last_four ? `••••-••••-${album.access_code_last_four}` : null,
        };
      }));
      const storage = await getStorageUsage(supabase);
      return json({
        albums,
        storage,
      });
    }

    if (action === 'save-album') {
      const album = body.album || {};
      const id = album.id || null;
      const slug = normalizeSlug(album.slug || album.title);

      if (!isValidSlug(slug)) return json({ error: 'Slug inválido.' }, 400);

      const payload: Record<string, unknown> = {
        slug,
        title: sanitizeText(album.title, 160),
        event_type: sanitizeText(album.eventType, 80) || 'Outro',
        event_date: album.eventDate || null,
        location: sanitizeText(album.location, 180) || null,
        description: sanitizeText(album.description, 1200) || null,
        guest_message: sanitizeText(album.guestMessage, 1200) || null,
        cover_path: album.coverPath || null,
        downloads_enabled: album.downloadsEnabled !== false,
        download_all_enabled: Boolean(album.downloadAllEnabled),
        watermark_enabled: album.watermarkEnabled !== false,
        watermark_position: 'bottom-center',
        watermark_opacity: 0.28,
        watermark_scale: 0.2,
        watermark_original_downloads: Boolean(album.watermarkOriginalDownloads),
        is_active: album.isActive !== false,
        is_archived: Boolean(album.isArchived),
        status: album.isArchived ? 'archived' : (album.isActive === false ? 'disabled' : sanitizeText(album.status, 20) || 'active'),
        expires_at: album.expiresAt || null,
      };

      if (!payload.title) return json({ error: 'O nome do evento é obrigatório.' }, 400);

      if (id) {
        const { data: currentAlbum, error: currentAlbumError } = await supabase
          .from('albums')
          .select('watermark_enabled, watermark_position, watermark_opacity, watermark_scale, watermark_original_downloads, watermark_version')
          .eq('id', id)
          .maybeSingle();
        if (currentAlbumError) throw currentAlbumError;
        if (currentAlbum && watermarkConfigChanged(currentAlbum, payload)) {
          payload.watermark_version = Number(currentAlbum.watermark_version || 1) + 1;
        }
        const { data, error } = await supabase
          .from('albums')
          .update(payload)
          .eq('id', id)
          .select(ADMIN_ALBUM_SELECT)
          .single();
        if (error) throw error;
        return json({ album: { ...data, access_code_masked: data.access_code_last_four ? `••••-••••-${data.access_code_last_four}` : null } });
      }

      const code = await createUniqueCode(supabase);
      const normalizedCode = normalizeGalleryCode(code);
      payload.access_code_hash = await hashAccessCode(code, getEnv('ACCESS_CODE_PEPPER'));
      payload.access_code_lookup = await lookupAccessCode(code, getEnv('ACCESS_CODE_PEPPER'));
      payload.access_code_last_four = normalizedCode.slice(-4);
      payload.access_code_created_at = new Date().toISOString();
      payload.access_code_encrypted = await encryptGalleryCode(code, getEnv('GALLERY_CODE_ENCRYPTION_KEY'));
      payload.created_by = admin.user.id;
      const { data, error } = await supabase
        .from('albums')
        .insert(payload)
        .select(ADMIN_ALBUM_SELECT)
        .single();
      if (error) throw error;
      return json({ album: { ...data, access_code_masked: maskGalleryCode(code) }, accessCode: code });
    }

    if (action === 'regenerate-code') {
      const albumId = String(body.albumId || '');
      const code = await createUniqueCode(supabase);
      const normalizedCode = normalizeGalleryCode(code);
      const { data: current, error: currentError } = await supabase
        .from('albums')
        .select('session_version')
        .eq('id', albumId)
        .maybeSingle();
      if (currentError || !current) return json({ error: 'Galeria não encontrada.' }, 404);

      const { data, error } = await supabase
        .from('albums')
        .update({
          access_code_hash: await hashAccessCode(code, getEnv('ACCESS_CODE_PEPPER')),
          access_code_lookup: await lookupAccessCode(code, getEnv('ACCESS_CODE_PEPPER')),
          access_code_last_four: normalizedCode.slice(-4),
          access_code_created_at: new Date().toISOString(),
          access_code_encrypted: await encryptGalleryCode(code, getEnv('GALLERY_CODE_ENCRYPTION_KEY')),
          session_version: (current.session_version || 1) + 1,
        })
        .eq('id', albumId)
        .select(ADMIN_ALBUM_SELECT)
        .single();
      if (error) throw error;
      await supabase.from('album_sessions').delete().eq('album_id', albumId);
      return json({ album: { ...data, access_code_masked: maskGalleryCode(code) }, accessCode: code });
    }

    if (action === 'get-code') {
      const albumId = String(body.albumId || '');
      const { data, error } = await supabase
        .from('albums')
        .select('id, access_code_encrypted')
        .eq('id', albumId)
        .maybeSingle();
      if (error || !data) return json({ error: 'Galeria não encontrada.' }, 404);
      if (!data.access_code_encrypted) {
        return json({
          error: 'Não é possível recuperar o código original desta galeria.',
          code: 'code_unrecoverable',
        }, 409);
      }
      let accessCode = '';
      try {
        accessCode = await decryptGalleryCode(data.access_code_encrypted, getEnv('GALLERY_CODE_ENCRYPTION_KEY'));
      } catch {
        return json({
          error: 'Não é possível recuperar o código original desta galeria.',
          code: 'code_unrecoverable',
        }, 409);
      }
      return json({ accessCode });
    }

    if (action === 'end-sessions') {
      const albumId = String(body.albumId || '');
      const { data: current } = await supabase.from('albums').select('session_version').eq('id', albumId).maybeSingle();
      await supabase.from('albums').update({ session_version: (current?.session_version || 1) + 1 }).eq('id', albumId);
      await supabase.from('album_sessions').delete().eq('album_id', albumId);
      return json({ ok: true });
    }

    if (action === 'create-storage-path') {
      const albumId = String(body.albumId || '');
      const filename = sanitizeText(body.filename, 240);
      assertAllowedImage({ type: String(body.mimeType || ''), size: Number(body.size || 0) });
      const path = buildStoragePath(albumId, filename, 'originals');
      return json({ path });
    }

    if (action === 'register-photo') {
      const photo = body.photo || {};
      const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('id, watermark_enabled, watermark_version')
        .eq('id', photo.albumId)
        .maybeSingle();
      if (albumError || !album) return json({ error: 'Galeria nÃ£o encontrada.' }, 404);
      const { data, error } = await supabase
        .from('album_photos')
        .insert({
          album_id: photo.albumId,
          storage_path: photo.storagePath,
          original_path: photo.storagePath,
          filename: sanitizeText(photo.filename, 240),
          caption: sanitizeText(photo.caption, 300) || null,
          sort_order: Number(photo.sortOrder || 0),
          width: photo.width || null,
          height: photo.height || null,
          size_bytes: Number.isFinite(Number(photo.sizeBytes)) ? Number(photo.sizeBytes) : null,
          watermark_mode: sanitizeWatermarkMode(photo.watermarkMode),
          processing_status: 'pending',
          watermark_version: 0,
        })
        .select('id, storage_path, original_path, web_path, watermarked_path, thumbnail_path, watermark_mode, processing_status, processing_error, filename, caption, sort_order, width, height, format, size_bytes, processed_at, watermark_version, created_at')
        .single();
      if (error) throw error;
      await enqueueWatermarkJobs(supabase, photo.albumId, [data.id]);
      return json({ photo: data });
    }

    if (action === 'queue-watermark-processing') {
      const albumId = String(body.albumId || '');
      const photoIds = Array.isArray(body.photoIds) ? body.photoIds.map(String) : [];
      const queued = await enqueueWatermarkJobs(supabase, albumId, photoIds);
      return json({ queued });
    }

    if (action === 'queue-existing-watermarks') {
      const albumId = String(body.albumId || '');
      const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('id, watermark_enabled, watermark_version')
        .eq('id', albumId)
        .maybeSingle();
      if (albumError || !album) return json({ error: 'Galeria nÃ£o encontrada.' }, 404);
      const { data: photos, error: photoError } = await supabase
        .from('album_photos')
        .select('id, web_path, watermarked_path, thumbnail_path, watermark_mode, processing_status, watermark_version')
        .eq('album_id', albumId);
      if (photoError) throw photoError;
      const photoIds = (photos || [])
        .filter((photo) => {
          const mode = photo.watermark_mode || 'inherit';
          const needsWatermark = mode === 'enabled' || (mode === 'inherit' && album.watermark_enabled);
          return !photo.web_path
            || !photo.thumbnail_path
            || (needsWatermark && !photo.watermarked_path)
            || photo.processing_status === 'failed'
            || Number(photo.watermark_version || 0) < Number(album.watermark_version || 1);
        })
        .map((photo) => photo.id);
      const queued = await enqueueWatermarkJobs(supabase, albumId, photoIds);
      return json({ queued });
    }

    if (action === 'set-photo-watermark-mode') {
      const albumId = String(body.albumId || '');
      const photoId = String(body.photoId || '');
      const mode = sanitizeWatermarkMode(body.mode);
      const { data: photo, error: photoError } = await supabase
        .from('album_photos')
        .update({ watermark_mode: mode })
        .eq('id', photoId)
        .eq('album_id', albumId)
        .select('id')
        .maybeSingle();
      if (photoError) throw photoError;
      if (!photo) return json({ error: 'Fotografia não encontrada.' }, 404);
      const queued = await enqueueWatermarkJobs(supabase, albumId, [photo.id]);
      return json({ ok: true, queued });
    }

    if (action === 'delete-photo') {
      const photoId = String(body.photoId || '');
      const { data: photo, error: findError } = await supabase
        .from('album_photos')
        .select('id, storage_path, original_path, web_path, watermarked_path, thumbnail_path')
        .eq('id', photoId)
        .maybeSingle();
      if (findError) throw findError;
      const paths = [photo?.storage_path, photo?.original_path, photo?.web_path, photo?.watermarked_path, photo?.thumbnail_path].filter(Boolean);
      if (paths.length) await supabase.storage.from(BUCKET).remove([...new Set(paths)]);
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
      const { data: photos } = await supabase.from('album_photos').select('storage_path, original_path, web_path, watermarked_path, thumbnail_path').eq('album_id', albumId);
      const paths = (photos || []).flatMap((photo) => [photo.storage_path, photo.original_path, photo.web_path, photo.watermarked_path, photo.thumbnail_path]).filter(Boolean);
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

async function createUniqueCode(supabase: ReturnType<typeof createServiceClient>) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateGalleryCode();
    const lookup = await lookupAccessCode(code, getEnv('ACCESS_CODE_PEPPER'));
    const { data } = await supabase
      .from('albums')
      .select('id')
      .eq('access_code_lookup', lookup)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error('Não foi possível gerar um código único.');
}

function sanitizeWatermarkMode(value: unknown) {
  const allowed = new Set(['inherit', 'enabled', 'disabled']);
  const normalized = sanitizeText(value, 20);
  return allowed.has(normalized) ? normalized : 'inherit';
}

function watermarkConfigChanged(current: Record<string, unknown>, next: Record<string, unknown>) {
  return Boolean(current.watermark_enabled) !== Boolean(next.watermark_enabled)
    || String(current.watermark_position || 'bottom-center') !== String(next.watermark_position || 'bottom-center')
    || Number(current.watermark_opacity ?? 0.3) !== Number(next.watermark_opacity ?? 0.3)
    || Number(current.watermark_scale ?? 0.2) !== Number(next.watermark_scale ?? 0.2)
    || Boolean(current.watermark_original_downloads) !== Boolean(next.watermark_original_downloads);
}

async function enqueueWatermarkJobs(
  supabase: ReturnType<typeof createServiceClient>,
  albumId: string,
  photoIds: string[],
) {
  const uniquePhotoIds = [...new Set(photoIds.filter(Boolean))];
  if (!albumId || !uniquePhotoIds.length) return 0;

  const { data: photos, error: photoError } = await supabase
    .from('album_photos')
    .select('id')
    .eq('album_id', albumId)
    .in('id', uniquePhotoIds);
  if (photoError) throw photoError;

  const ids = (photos || []).map((photo) => photo.id);
  if (!ids.length) return 0;

  await supabase
    .from('album_photos')
    .update({ processing_status: 'pending', processing_error: null })
    .in('id', ids);

  const { error: jobError } = await supabase
    .from('image_processing_jobs')
    .upsert(ids.map((photoId) => ({
      album_id: albumId,
      photo_id: photoId,
      job_type: 'watermark',
      status: 'pending',
      processing_error: null,
      locked_at: null,
      locked_by: null,
      finished_at: null,
    })), { onConflict: 'photo_id,job_type', ignoreDuplicates: false });

  if (jobError) throw jobError;
  return ids.length;
}

async function getStorageUsage(supabase: ReturnType<typeof createServiceClient>) {
  try {
    const { data, error } = await supabase
      .schema('storage')
      .from('objects')
      .select('metadata')
      .eq('bucket_id', BUCKET)
      .like('name', 'albums/%');
    if (error) throw error;
    let knownSizes = 0;
    const bytes = (data || []).reduce((total, item) => {
      const rawSize = item?.metadata?.size ?? item?.metadata?.contentLength;
      if (rawSize === null || rawSize === undefined) return total;
      const size = Number(rawSize);
      if (!Number.isFinite(size)) return total;
      knownSizes += 1;
      return total + size;
    }, 0);
    if (!knownSizes) throw new Error('Storage size metadata unavailable.');
    return {
      bytes,
      quotaBytes: 150 * 1024 * 1024 * 1024,
      source: 'storage.objects',
    };
  } catch {
    try {
      const { data, error } = await supabase
        .from('album_photos')
        .select('size_bytes');
      if (error) throw error;
      let knownSizes = 0;
      const bytes = (data || []).reduce((total, item) => {
        if (item?.size_bytes === null || item?.size_bytes === undefined) return total;
        const size = Number(item.size_bytes);
        if (!Number.isFinite(size)) return total;
        knownSizes += 1;
        return total + size;
      }, 0);
      if (!knownSizes) return null;
      return {
        bytes,
        quotaBytes: 150 * 1024 * 1024 * 1024,
        source: 'album_photos.size_bytes',
        approximate: true,
      };
    } catch {
      return null;
    }
  }
}
