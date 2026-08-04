/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Poll the filesystem for changes. In this sandboxed environment native file
  // events don't always fire, which left the dev server serving stale modules.
  server: {
    watch: { usePolling: true },
  },
  test: {
    // Node by default (the bulk of the suite is pure logic); component tests opt
    // into jsdom with a `// @vitest-environment jsdom` docblock at the top of the
    // file, so they get a DOM without slowing the logic tests down.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.mjs'],
    setupFiles: ['src/test/setup.ts'],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-auth': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
