import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = 'private-galleries';
const WORKER_ID = `watermark-worker-${process.pid}`;
const LIMIT = Number(process.env.WATERMARK_WORKER_LIMIT || 12);
const LOGO_PATH = process.env.WATERMARK_LOGO_PATH
  ? path.resolve(process.env.WATERMARK_LOGO_PATH)
  : path.resolve(__dirname, '../assets/logo-arnaut.png');
const WATERMARK_SETTINGS = {
  watermark_position: 'bottom-center',
  watermark_opacity: 0.68,
  watermark_scale: 0.22,
};

function normalizeSupabaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return raw
      .replace(/\/(?:rest|functions|auth|storage)\/v1\/?$/, '')
      .replace(/\/$/, '');
  }
}

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SECRET_KEYS;

function normalizeSecretKey(value) {
  if (!value) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed.default || value;
  } catch {
    return value;
  }
}

const serviceKey = normalizeSecretKey(rawServiceKey);

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing SUPABASE_URL and service role/secret key for watermark worker.');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function processedPath(albumId, photoId, variant) {
  return `albums/${albumId}/${variant}/${photoId}.webp`;
}

async function downloadObject(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function uploadObject(storagePath, buffer) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (error) throw error;
}

async function prepareWatermarkAsset(asset, opacity) {
  const metadata = await sharp(asset).metadata();
  const safeOpacity = Math.min(1, Math.max(0, Number(opacity) || 0.68));

  const { data, info } = await sharp(asset)
    .ensureAlpha()
    .trim({
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      threshold: 2,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(info.width * info.height * 4);

  for (let source = 0, target = 0; source < data.length; source += 4, target += 4) {
    const red = data[source];
    const green = data[source + 1];
    const blue = data[source + 2];
    const sourceAlpha = data[source + 3];
    let logoAlpha = sourceAlpha;

    if (!metadata.hasAlpha) {
      const luminance = (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
      logoAlpha = Math.round(Math.max(0, Math.min(1, (250 - luminance) / 42)) * 255);
    }

    output[target] = red;
    output[target + 1] = green;
    output[target + 2] = blue;
    output[target + 3] = Math.round(logoAlpha * safeOpacity);
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

async function renderWatermarkAsset(asset, resize) {
  return sharp(asset)
    .resize({ ...resize, kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .sharpen({ sigma: 0.35 })
    .png()
    .toBuffer();
}

async function addWatermark(base, logoAsset, settings) {
  const metadata = await sharp(base).rotate().metadata();
  const width = metadata.width || 1600;
  const height = metadata.height || 1200;
  const scale = Math.min(0.45, Math.max(0.08, Number(settings.watermark_scale) || 0.2));
  const watermark = await renderWatermarkAsset(logoAsset, {
    width: Math.max(120, Math.round(width * scale)),
    withoutEnlargement: true,
  });
  const watermarkMetadata = await sharp(watermark).metadata();
  const watermarkWidth = watermarkMetadata.width || Math.max(120, Math.round(width * scale));
  const watermarkHeight = watermarkMetadata.height || Math.round(watermarkWidth * 0.47);
  const columns = Math.max(3, Math.min(5, Math.ceil(width / (watermarkWidth * 2))));
  const rows = Math.max(3, Math.min(6, Math.ceil(height / (watermarkHeight * 3.1))));
  const columnWidth = width / columns;
  const rowHeight = height / rows;
  const composites = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let centerX = ((column + 0.5) * columnWidth)
        + (row % 2 === 1 ? columnWidth * 0.5 : 0);
      if (centerX >= width) centerX -= width;

      composites.push({
        input: watermark,
        left: Math.max(0, Math.min(
          width - watermarkWidth,
          Math.round(centerX - (watermarkWidth / 2)),
        )),
        top: Math.max(0, Math.min(
          height - watermarkHeight,
          Math.round(((row + 0.5) * rowHeight) - (watermarkHeight / 2)),
        )),
        blend: 'over',
      });
    }
  }

  return sharp(base).rotate().composite(composites);
}

async function processJob(job, logoSource, preparedLogoCache) {
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, watermark_enabled, watermark_position, watermark_opacity, watermark_scale, watermark_version')
    .eq('id', job.album_id)
    .single();
  if (albumError) throw albumError;

  const { data: photo, error: photoError } = await supabase
    .from('album_photos')
    .select('id, album_id, original_path, storage_path, web_path, watermarked_path, thumbnail_path, watermark_mode, filename')
    .eq('id', job.photo_id)
    .single();
  if (photoError) throw photoError;

  const originalPath = photo.original_path || photo.storage_path;
  const original = await downloadObject(originalPath);
  const webPath = processedPath(album.id, photo.id, 'web');
  const thumbPath = processedPath(album.id, photo.id, 'thumbs');
  const mode = photo.watermark_mode || 'inherit';
  const usesWatermark = mode === 'enabled' || (mode === 'inherit' && album.watermark_enabled);
  const watermarkSettings = {
    watermark_position: album.watermark_position || WATERMARK_SETTINGS.watermark_position,
    watermark_opacity: Number(album.watermark_opacity ?? WATERMARK_SETTINGS.watermark_opacity),
    watermark_scale: Number(album.watermark_scale ?? WATERMARK_SETTINGS.watermark_scale),
  };

  const resizedBase = await sharp(original)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 6, adaptiveFiltering: true })
    .toBuffer();
  const webBuffer = await sharp(resizedBase)
    .webp({ quality: 94, effort: 5, smartSubsample: true })
    .toBuffer();

  let displayBuffer = webBuffer;
  const update = {
    web_path: webPath,
    thumbnail_path: thumbPath,
    processing_status: 'ready',
    processing_error: null,
    format: 'webp',
    processed_at: new Date().toISOString(),
    watermark_version: album.watermark_version,
  };

  if (usesWatermark) {
    const watermarkedPath = processedPath(album.id, photo.id, 'watermarked');
    const opacityKey = watermarkSettings.watermark_opacity.toFixed(3);
    if (!preparedLogoCache.has(opacityKey)) {
      preparedLogoCache.set(
        opacityKey,
        await prepareWatermarkAsset(logoSource, watermarkSettings.watermark_opacity),
      );
    }
    displayBuffer = await (
      await addWatermark(resizedBase, preparedLogoCache.get(opacityKey), watermarkSettings)
    )
      .webp({ quality: 94, effort: 5, smartSubsample: true })
      .toBuffer();
    await uploadObject(watermarkedPath, displayBuffer);
    update.watermarked_path = watermarkedPath;
  }

  const thumbBuffer = await sharp(displayBuffer)
    .resize({ width: 640, height: 640, fit: 'cover', position: 'attention' })
    .webp({ quality: 84, effort: 5, smartSubsample: true })
    .toBuffer();

  await uploadObject(webPath, webBuffer);
  await uploadObject(thumbPath, thumbBuffer);

  const webMeta = await sharp(displayBuffer).metadata();
  update.width = webMeta.width || null;
  update.height = webMeta.height || null;
  await supabase.from('album_photos').update(update).eq('id', photo.id);
}

async function claimJobs() {
  const { data: jobs, error } = await supabase
    .from('image_processing_jobs')
    .select('id, album_id, photo_id, attempts')
    .in('status', ['pending', 'failed'])
    .lt('attempts', 3)
    .order('created_at', { ascending: true })
    .limit(LIMIT);
  if (error) throw error;

  const claimed = [];
  for (const job of jobs || []) {
    const { data, error: updateError } = await supabase
      .from('image_processing_jobs')
      .update({
        status: 'processing',
        attempts: Number(job.attempts || 0) + 1,
        locked_at: new Date().toISOString(),
        locked_by: WORKER_ID,
        processing_error: null,
      })
      .eq('id', job.id)
      .in('status', ['pending', 'failed'])
      .select('id, album_id, photo_id, attempts')
      .maybeSingle();
    if (updateError) throw updateError;
    if (data) claimed.push(data);
  }
  return claimed;
}

async function markJob(job, status, errorMessage = null) {
  await supabase.from('image_processing_jobs').update({
    status,
    processing_error: errorMessage,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id);

  if (status === 'failed') {
    await supabase.from('album_photos').update({
      processing_status: 'failed',
      processing_error: errorMessage,
    }).eq('id', job.photo_id);
  }
}

async function main() {
  const logoSource = await readFile(LOGO_PATH);
  const preparedLogoCache = new Map();
  const jobs = await claimJobs();
  if (!jobs.length) {
    console.log('No pending watermark jobs.');
    return;
  }

  for (const job of jobs) {
    try {
      await supabase.from('album_photos').update({
        processing_status: 'processing',
        processing_error: null,
      }).eq('id', job.photo_id);
      await processJob(job, logoSource, preparedLogoCache);
      await markJob(job, 'ready');
      console.log(`Processed watermark job ${job.id}`);
    } catch (error) {
      const message = String(error?.message || error).slice(0, 700);
      await markJob(job, 'failed', message);
      console.error(`Failed watermark job ${job.id}: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
