import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    // Use modulePreload false to prevent module preloading
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'src/popup/index.html'),
        background: path.resolve(__dirname, 'src/background/background.ts'),
        content: path.resolve(__dirname, 'src/content/content.ts'),
        'connect-bridge': path.resolve(__dirname, 'src/content/connect-bridge.ts'),
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
});

