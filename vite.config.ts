import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE ?? '/',
  css: {
    postcss: './postcss.config.cjs',
  },
});