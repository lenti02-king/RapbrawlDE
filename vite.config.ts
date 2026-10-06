import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // NO_HMR=1: a second dev server for long scripted captures that must not reload while sources change
  server: process.env.NO_HMR ? { hmr: false, watch: null } : undefined,
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
