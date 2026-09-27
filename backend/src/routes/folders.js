import { Router } from 'express';
import { getSupabase, isSupabaseReady } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = Router();
router.use(requireAuth);

// ── GET /api/folders ──────────────────────────────────────────────────────────
router.get('/', async (_req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: folders, error } = await supabase
      .from('folders')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    const plain = (folders || []).map(f => ({
      id: f.id,
      name: f.name,
      parent_id: f.parent_id,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }));

    // Build hierarchical tree
    const map = {};
    plain.forEach(f => { map[f.id] = { ...f, children: [] }; });
    const tree = [];
    plain.forEach(f => {
      if (f.parent_id && map[f.parent_id]) {
        map[f.parent_id].children.push(map[f.id]);
      } else if (!f.parent_id) {
        tree.push(map[f.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/folders/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: folder, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !folder) return res.status(404).json({ error: 'Folder not found' });
    res.json(folder);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/folders ─────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { name, parentId } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Folder name required' });

    if (parentId) {
      const { data: parent } = await supabase.from('folders').select('id').eq('id', parentId).single();
      if (!parent) return res.status(400).json({ error: 'Parent folder not found' });
    }

    const { data: created, error } = await supabase
      .from('folders')
      .insert({
        name: name.trim(),
        parent_id: parentId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity('FOLDER_CREATE', `Created folder "${name.trim()}"`, req.ip);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/folders/:id ────────────────────────────────────────────────────
router.patch('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { name, parentId } = req.body;
    if (parentId === req.params.id) {
      return res.status(400).json({ error: 'Folder cannot be its own parent' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name?.trim()) updates.name = name.trim();
    if (parentId !== undefined) updates.parent_id = parentId || null;

    const { data: updated, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ error: 'Folder not found' });

    await logActivity('FOLDER_RENAME', `Updated folder "${updated.name}"`, req.ip);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/folders/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    const { data: folder } = await supabase.from('folders').select('name').eq('id', req.params.id).single();
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    // In Supabase, if parent_id has ON DELETE CASCADE, deleting this folder deletes child folders & files automatically!
    const { error } = await supabase.from('folders').delete().eq('id', req.params.id);
    if (error) throw error;

    await logActivity('FOLDER_DELETE', `Deleted folder "${folder.name}"`, req.ip);
    res.json({ message: 'Folder and contents deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
