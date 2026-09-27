import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dbnntrkqayrotfovyfev.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_hnsigSRo0FnZO7rR_SrZvQ_bOg4UJqI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
