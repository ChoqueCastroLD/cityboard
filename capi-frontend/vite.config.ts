import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', 'three/webgpu', 'three/tsl'],
          vendor: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query', 'motion'],
        },
      },
    },
  },
});
