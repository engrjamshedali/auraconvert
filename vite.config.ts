import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

/**
 * Prevents @vite/client from opening a failing HMR WebSocket in environments
 * where HMR WebSockets are disabled, while preserving updateStyle/removeStyle/createHotContext.
 */
function disableViteClientWebSocket(): Plugin {
  return {
    name: 'disable-vite-client-websocket',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('vite/dist/client/client.mjs')) {
        return code.replace(
          /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
          '/* WebSocket HMR connection disabled */'
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), disableViteClientWebSocket()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: false,
    ws: false,
    watch: null,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-editor': ['@monaco-editor/react'],
          'vendor-ui': ['lucide-react', 'motion', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
