import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);

  return {
    plugins: [
      react(),
      {
        name: 'transform-placeholders',
        writeBundle() {
          const distPath = path.resolve(__dirname, 'dist');

          // Helper to recursively process files
          const processDirectory = (dir: string) => {
            const files = fs.readdirSync(dir);

            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);

              if (stat.isDirectory()) {
                processDirectory(fullPath);
              } else if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html')) {
                let content = fs.readFileSync(fullPath, 'utf-8');
                let modified = false;

                if (env.NEXT_PUBLIC_URL && content.includes('__FRONTEND_URL__')) {
                  const origin = new URL(env.NEXT_PUBLIC_URL).origin;
                  content = content.replaceAll('__FRONTEND_URL__', origin);
                  modified = true;
                }

                if (env.NEXT_PUBLIC_BACKEND_URL && content.includes('__BACKEND_URL__')) {
                  content = content.replaceAll('__BACKEND_URL__', env.NEXT_PUBLIC_BACKEND_URL);
                  modified = true;
                }

                if (modified) {
                  fs.writeFileSync(fullPath, content);
                  console.log(`[Kortix Build] Finalized placeholders in: ${path.relative(distPath, fullPath)}`);
                }
              }
            }
          };

          if (fs.existsSync(distPath)) {
            processDirectory(distPath);
          }
        }
      }
    ],
    publicDir: 'public',
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      copyPublicDir: true,
      // Disable minification to avoid variable name collisions in content scripts
      minify: false,
      // Use modulePreload false to prevent module preloading
      modulePreload: false,
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, 'popup.html'),
          background: path.resolve(__dirname, 'src/background/background.ts'),
          content: path.resolve(__dirname, 'src/content/content.ts'),
          'connect-bridge': path.resolve(__dirname, 'src/content/connect-bridge.ts'),
          offscreen: path.resolve(__dirname, 'src/offscreen/offscreen.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          // Force all modules to be inlined (no code splitting for content scripts)
          manualChunks: undefined,
        },
      },
      // Target ES2020 for Chrome extension compatibility
      target: 'es2020',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});

