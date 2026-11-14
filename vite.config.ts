import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';

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

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), disableViteClientWebSocket()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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
  };
});
