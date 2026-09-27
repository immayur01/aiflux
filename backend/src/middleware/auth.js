import { getSupabase, isSupabaseReady } from '../config/supabase.js';

/**
 * Authenticate requests using Supabase JWT in Authorization header:
 * Authorization: Bearer <supabase_access_token>
 */
export async function requireAuth(req, res, next) {
  try {
    const supabase = getSupabase();
    if (!isSupabaseReady() || !supabase) {
      return res.status(503).json({
        error: 'Supabase is not configured on the server. Please add SUPABASE_URL and SUPABASE_ANON_KEY to backend/.env',
      });
    }

    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthenticated: No token provided' });
    }

    // Verify token using Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid or expired Supabase authentication session',
        details: error?.message,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Authentication failed',
      details: err.message,
    });
  }
}
