import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  minify: true,
  clean: true,
  target: 'esnext',
  external: ['react', 'react-dom'],
  // Lets the component be imported straight into React Server Components (e.g. Next.js App Router)
  banner: { js: '"use client";' },
});
