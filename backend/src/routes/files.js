import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import sanitize from 'sanitize-filename';
import mime from 'mime-types';
import { getSupabase, isSupabaseReady } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../data/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'flux-files';

const router = Router();
router.use(requireAuth);

// Memory storage for flexible dispatch to Supabase Storage or disk (supports all file formats)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB per file
});

async function getQuotaBytes(supabase) {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'max_storage_bytes')
      .single();
    if (data?.value) return Number(data.value);
  } catch {}
  return 500 * 1024 * 1024; // 500 MB default
}

async function getUsedBytes(supabase) {
  try {
    const { data, error } = await supabase.from('files').select('size_bytes');
    if (error || !data) return 0;
    return data.reduce((sum, f) => sum + Number(f.size_bytes || 0), 0);
  } catch {
    return 0;
  }
}

// ── GET /api/files?folderId=&search= ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { folderId, search } = req.query;

    let query = supabase.from('files').select('*');

    if (search) {
      query = query.ilike('original_name', `%${search}%`);
    } else if (folderId) {
      query = query.eq('folder_id', folderId);
    } else {
      return res.status(400).json({ error: 'folderId or search parameter required' });
    }

    const { data: rows, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    res.json(rows || []);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/files/storage-info ───────────────────────────────────────────────
router.get('/storage-info', async (_req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const used = await getUsedBytes(supabase);
    const quota = await getQuotaBytes(supabase);
    res.json({
      usedBytes: used,
      quotaBytes: quota,
      usedMb: +(used / 1024 / 1024).toFixed(2),
      quotaMb: +(quota / 1024 / 1024).toFixed(2),
      percentUsed: quota > 0 ? +((used / quota) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/files/signed-upload-url ─────────────────────────────────────────
// Generates a pre-signed upload URL using the backend's admin/service key.
// The browser uploads directly to Supabase via this URL — NO RLS policies needed on the bucket!
router.post('/signed-upload-url', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { folderId, originalName, sizeBytes } = req.body;
    if (!folderId || !originalName) {
      return res.status(400).json({ error: 'folderId and originalName are required' });
    }

    // Verify folder exists
    const { data: folder } = await supabase.from('folders').select('id').eq('id', folderId).single();
    if (!folder) return res.status(400).json({ error: 'Target folder not found' });

    // Check quota
    const used = await getUsedBytes(supabase);
    const quota = await getQuotaBytes(supabase);
    if (used + Number(sizeBytes || 0) > quota) {
      const availMb = ((quota - used) / 1024 / 1024).toFixed(1);
      return res.status(413).json({ error: `Storage quota exceeded. ${availMb} MB available.` });
    }

    const fileId = uuidv4();
    const safeName = sanitize(originalName) || originalName;
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext).slice(0, 80);
    const storedName = `${fileId}_${base}${ext}`;
    const storagePath = `uploads/${fileId}/${storedName}`;

    // Create a signed upload URL via Supabase Storage admin
    const { data: signedData, error: signErr } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (signErr) {
      logger.error(`Failed to create signed upload url: ${signErr.message}`);
      return res.status(500).json({ error: `Storage error: ${signErr.message}` });
    }

    res.json({
      fileId,
      safeName,
      storedName,
      storagePath,
      signedUrl: signedData.signedUrl,
      token: signedData.token,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/files/register (Direct-to-Supabase upload, metadata registration only) ───
// The browser uploads the file directly to Supabase Storage and then calls this endpoint
// with just JSON metadata — no file binary passes through Render.
router.post('/register', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { fileId, folderId, originalName, storedName, storagePath, mimeType, sizeBytes } = req.body;

    if (!fileId || !folderId || !originalName) {
      return res.status(400).json({ error: 'fileId, folderId, and originalName are required' });
    }

    // Verify folder exists
    const { data: folder } = await supabase.from('folders').select('id').eq('id', folderId).single();
    if (!folder) return res.status(400).json({ error: 'Target folder not found' });

    // Check quota
    const used = await getUsedBytes(supabase);
    const quota = await getQuotaBytes(supabase);
    if (used + Number(sizeBytes || 0) > quota) {
      const availMb = ((quota - used) / 1024 / 1024).toFixed(1);
      return res.status(413).json({ error: `Storage quota exceeded. ${availMb} MB available.` });
    }

    const now = new Date().toISOString();
    const safeName = sanitize(originalName) || originalName;

    const fileRecord = {
      id: fileId,
      folder_id: folderId,
      original_name: safeName,
      stored_name: storedName || safeName,
      storage_path: storagePath || null,
      mime_type: mimeType || 'application/octet-stream',
      size_bytes: Number(sizeBytes || 0),
      created_at: now,
      updated_at: now,
    };

    const { error: insertErr } = await supabase.from('files').insert(fileRecord);
    if (insertErr) throw insertErr;

    await logActivity('FILE_UPLOAD', `Uploaded "${safeName}" to folder ${folderId} (direct)`, req.ip);
    res.status(201).json({ id: fileId, original_name: safeName, size_bytes: Number(sizeBytes) });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/files/upload?folderId= (Legacy: files pass through Render) ─────
router.post('/upload', (req, res) => {
  const { folderId } = req.query;
  if (!folderId) return res.status(400).json({ error: 'folderId required' });

  upload.array('files', 50)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    try {
      const supabase = getSupabase();
      if (!isSupabaseReady() || !supabase) {
        return res.status(503).json({ error: 'Supabase is not configured' });
      }

      // Check folder exists
      const { data: folder } = await supabase.from('folders').select('id').eq('id', folderId).single();
      if (!folder) {
        return res.status(400).json({ error: 'Target folder not found in database' });
      }

      // Check quota
      const used = await getUsedBytes(supabase);
      const quota = await getQuotaBytes(supabase);
      const incoming = files.reduce((s, f) => s + f.size, 0);

      if (used + incoming > quota) {
        const availMb = ((quota - used) / 1024 / 1024).toFixed(1);
        return res.status(413).json({
          error: `Storage quota exceeded. You have ${availMb} MB available.`,
        });
      }

      const inserted = [];
      const now = new Date().toISOString();

      for (const file of files) {
        const fileId = uuidv4();
        const safeName = sanitize(file.originalname) || file.originalname || 'file';
        const ext = path.extname(safeName);
        const base = path.basename(safeName, ext).slice(0, 80);
        const storedName = `${fileId}_${base}${ext}`;
        const storagePath = `uploads/${fileId}/${storedName}`;
        const detectedMime = mime.lookup(safeName) || file.mimetype || 'application/octet-stream';

        // Try Supabase Storage bucket first; if not configured or fails, fallback to local disk
        let useCloudStorage = false;
        try {
          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file.buffer, {
              contentType: detectedMime,
              upsert: true,
            });
          if (!uploadError) useCloudStorage = true;
        } catch {}

        // Fallback to local disk if cloud bucket is not initialized
        if (!useCloudStorage) {
          const localPath = path.join(UPLOAD_DIR, storedName);
          fs.writeFileSync(localPath, file.buffer);
        }

        const fileRecord = {
          id: fileId,
          folder_id: folderId,
          original_name: safeName,
          stored_name: storedName,
          storage_path: useCloudStorage ? storagePath : null,
          mime_type: detectedMime,
          size_bytes: file.size,
          created_at: now,
          updated_at: now,
        };

        const { error: insertErr } = await supabase.from('files').insert(fileRecord);
        if (insertErr) throw insertErr;

        inserted.push({ id: fileId, original_name: safeName, size_bytes: file.size });
      }

      await logActivity('FILE_UPLOAD', `Uploaded ${files.length} file(s) to folder ${folderId}`, req.ip);
      res.status(201).json({ uploaded: inserted });
    } catch (uploadErr) {
      logger.error(`Upload error: ${uploadErr.message}`);
      res.status(500).json({ error: `Upload failed: ${uploadErr.message}` });
    }
  });
});

// ── GET /api/files/:id/download ───────────────────────────────────────────────
router.get('/:id/download', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: file, error } = await supabase.from('files').select('*').eq('id', req.params.id).single();
    if (error || !file) return res.status(404).json({ error: 'File not found' });

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);

    // Download from Supabase Cloud Storage if available
    if (file.storage_path) {
      const { data: blob, error: downloadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .download(file.storage_path);

      if (!downloadErr && blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        await logActivity('FILE_DOWNLOAD', `Downloaded "${file.original_name}"`, req.ip);
        return res.send(buffer);
      }
    }

    // Fallback to local disk
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing from storage' });
    }

    await logActivity('FILE_DOWNLOAD', `Downloaded "${file.original_name}"`, req.ip);
    res.download(filePath, file.original_name);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/files/:id/preview ────────────────────────────────────────────────
router.get('/:id/preview', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: file, error } = await supabase.from('files').select('*').eq('id', req.params.id).single();
    if (error || !file) return res.status(404).json({ error: 'File not found' });

    const previewable = ['image/', 'text/', 'application/pdf'].some(p => (file.mime_type || '').startsWith(p));
    if (!previewable) return res.status(415).json({ error: 'Preview not available for this file type' });

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', 'inline');

    // From Supabase Storage
    if (file.storage_path) {
      const { data: blob, error: downloadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .download(file.storage_path);

      if (!downloadErr && blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        return res.send(buffer);
      }
    }

    // Fallback local file
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing from storage' });
    }

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/files/:id ──────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { name, folderId } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    if (folderId) updates.folder_id = folderId;
    if (name?.trim()) updates.original_name = sanitize(name.trim());

    const { data: updated, error } = await supabase
      .from('files')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ error: 'File not found' });

    await logActivity('FILE_RENAME', `Renamed/moved "${updated.original_name}"`, req.ip);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/files/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: file } = await supabase.from('files').select('*').eq('id', req.params.id).single();
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Remove from Supabase Storage if present
    if (file.storage_path) {
      try {
        await supabase.storage.from(BUCKET_NAME).remove([file.storage_path]);
      } catch {}
    }

    // Remove from local disk if present
    if (file.stored_name) {
      const filePath = path.join(UPLOAD_DIR, file.stored_name);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    await supabase.from('files').delete().eq('id', req.params.id);
    await logActivity('FILE_DELETE', `Deleted "${file.original_name}"`, req.ip);

    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
