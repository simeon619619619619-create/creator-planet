import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
              'vendor-recharts': ['recharts'],
              'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
              'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
              'vendor-icons': ['lucide-react'],
              'vendor-markdown': ['react-markdown'],
              'vendor-query': ['@tanstack/react-query'],
            }
          }
        }
      }
    };
});
