import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.DEPLOY_TARGET === 'github-pages' ? '/tangible/' : './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    strictPort: true,
  },
});
