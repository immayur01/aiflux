import { getSupabase } from '../config/supabase.js';
import { logger } from './logger.js';

export async function logActivity(action, detail = '', ip = '') {
  try {
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from('activity_logs').insert({
      action,
      detail,
      ip,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`Failed to log activity to Supabase: ${err.message}`);
  }
}
