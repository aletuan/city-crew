import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths: the build works at any mount point
  // (GitHub Pages /city-crew/, a custom domain, or vite preview).
  base: './',
  plugins: [react()],
  server: { port: 5180 },
});
