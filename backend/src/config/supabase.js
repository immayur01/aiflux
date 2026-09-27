import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

let supabase = null;
let isConfigured = false;

export function initSupabase() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  // Use service_role key for backend admin operations, or fallback to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key && url !== 'https://your-project-id.supabase.co') {
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      isConfigured = true;
      logger.info(`⚡ Supabase client initialized for: ${url}`);
      seedDefaultData().catch(err => logger.warn(`Supabase seed check: ${err.message}`));
    } catch (err) {
      logger.error(`Failed to initialize Supabase: ${err.message}`);
    }
  } else {
    logger.warn('⚠️ No active Supabase credentials found! Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in backend/.env');
  }

  return supabase;
}

async function seedDefaultData() {
  if (!supabase) return;

  try {
    // Check if folders table has any rows
    const { data: existingFolders, error: folderErr } = await supabase
      .from('folders')
      .select('id')
      .limit(1);

    if (!folderErr && (!existingFolders || existingFolders.length === 0)) {
      await supabase.from('folders').insert([
        { name: 'Software', parent_id: null },
        { name: 'Operating System', parent_id: null },
        { name: 'Codebase / Projects', parent_id: null },
      ]);
      logger.info('Initialized default folders in Supabase: Software, Operating System, Codebase / Projects');
    }

    // Check settings table
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('key')
      .eq('key', 'max_storage_bytes')
      .single();

    if (!existingSettings) {
      await supabase.from('settings').upsert({
        key: 'max_storage_bytes',
        value: String(500 * 1024 * 1024),
      });
    }
  } catch (err) {
    logger.warn(`Could not seed default data in Supabase: ${err.message}`);
  }
}

export function getSupabase() {
  if (!supabase) initSupabase();
  return supabase;
}

export function isSupabaseReady() {
  return isConfigured && !!supabase;
}
