import { Router } from 'express';
import { getSupabase, isSupabaseReady } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: rows, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    const map = {};
    (rows || []).forEach(r => { map[r.key] = r.value; });

    res.json({
      max_storage_bytes: map.max_storage_bytes || String(500 * 1024 * 1024),
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { max_storage_mb } = req.body;
    if (max_storage_mb !== undefined) {
      const mb = Number(max_storage_mb);
      if (isNaN(mb) || mb < 1) {
        return res.status(400).json({ error: 'Invalid storage quota value' });
      }

      await supabase.from('settings').upsert({
        key: 'max_storage_bytes',
        value: String(mb * 1024 * 1024),
        updated_at: new Date().toISOString(),
      });
    }

    const { data: rows } = await supabase.from('settings').select('*');
    const map = {};
    (rows || []).forEach(r => { map[r.key] = r.value; });

    res.json({
      max_storage_bytes: map.max_storage_bytes || String(500 * 1024 * 1024),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/activity-log', async (_req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    res.json(logs || []);
  } catch (err) {
    next(err);
  }
});

export default router;
