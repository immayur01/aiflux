import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dbnntrkqayrotfovyfev.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_hnsigSRo0FnZO7rR_SrZvQ_bOg4UJqI'
    ),
    'import.meta.env.VITE_ADMIN_EMAIL': JSON.stringify(
      process.env.VITE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'mayursewatkar237@gmail.com'
    ),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
