import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'express-api-dev-server',
        configureServer(server) {
          process.env.VITE_DEV_SERVER = 'true';
          let appPromise: Promise<any> | null = null;
          const getApp = () => {
            if (!appPromise) {
              appPromise = server
                .ssrLoadModule('./api/index.ts')
                .then((mod) => mod.default)
                .catch((err) => {
                  appPromise = null;
                  throw err;
                });
            }
            return appPromise;
          };

          server.watcher.on('change', (file) => {
            if (file.includes('/api/')) {
              appPromise = null;
            }
          });

          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
              try {
                const app = await getApp();
                return app(req, res, next);
              } catch (err) {
                appPromise = null;
                console.error('API middleware error:', err);
                return next(err);
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
