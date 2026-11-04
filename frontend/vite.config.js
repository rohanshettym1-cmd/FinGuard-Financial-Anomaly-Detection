import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/test/**/*.test.{js,jsx}'],
    setupFiles: './src/test/setup.js',
    restoreMocks: true,
  },
});
