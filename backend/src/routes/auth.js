import { Router } from 'express';
import { getSupabase, isSupabaseReady } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLog.js';

const router = Router();

// ── GET /api/auth/status ──────────────────────────────────────────────────────
router.get('/status', async (_req, res) => {
  let ownerEmail = process.env.ADMIN_EMAIL || null;
  if (!ownerEmail && isSupabaseReady()) {
    try {
      const { data } = await getSupabase().auth.admin.listUsers({ page: 1, perPage: 1 });
      if (data?.users?.length > 0) {
        ownerEmail = data.users[0].email;
      }
    } catch {}
  }
  res.json({
    isSetup: true,
    isSupabaseConfigured: isSupabaseReady(),
    ownerEmail,
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
    },
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await logActivity('LOGOUT', `User ${req.user.email} signed out`, req.ip);
  res.json({ message: 'Logged out successfully' });
});

export default router;
