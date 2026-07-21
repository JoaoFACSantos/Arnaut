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
  : path.resolve(__dirname, '../assets/logo-watermark.svg');
const WATERMARK_SETTINGS = {
  watermark_position: 'bottom-center',
  watermark_opacity: 0.28,
  watermark_scale: 0.2,
};

const supabaseUrl = String(process.env.SUPABASE_URL || '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');
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

function watermarkGravity(position) {
  return {
    'bottom-center': 'south',
    'bottom-right': 'southeast',
    'bottom-left': 'southwest',
    center: 'centre',
  }[position] || 'south';
}

function watermarkSvgWithOpacity(svg, opacity) {
  const safeOpacity = Math.min(1, Math.max(0, Number(opacity) || 0.3));
  return svg.replace('<svg ', `<svg opacity="${safeOpacity}" `);
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

async function addWatermark(base, logoSvg, settings) {
  const source = sharp(base).rotate();
  const metadata = await source.metadata();
  const width = metadata.width || 1600;
  const scale = Math.min(0.45, Math.max(0.08, Number(settings.watermark_scale) || 0.2));
  const watermarkWidth = Math.max(96, Math.round(width * scale));
  const watermark = await sharp(Buffer.from(watermarkSvgWithOpacity(logoSvg, settings.watermark_opacity)))
    .resize({ width: watermarkWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  return source.composite([{
    input: watermark,
    gravity: watermarkGravity(settings.watermark_position),
    blend: 'over',
  }]);
}

async function processJob(job, logoSvg) {
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, watermark_enabled, watermark_version')
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

  const webBuffer = await sharp(original)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
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
    displayBuffer = await (await addWatermark(webBuffer, logoSvg, WATERMARK_SETTINGS))
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    await uploadObject(watermarkedPath, displayBuffer);
    update.watermarked_path = watermarkedPath;
  }

  const thumbBuffer = await sharp(displayBuffer)
    .resize({ width: 640, height: 640, fit: 'cover', position: 'attention' })
    .webp({ quality: 78, effort: 4 })
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
    .in('status', ['pending'])
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
      .eq('status', 'pending')
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
  const logoSvg = await readFile(LOGO_PATH, 'utf8');
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
      await processJob(job, logoSvg);
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
