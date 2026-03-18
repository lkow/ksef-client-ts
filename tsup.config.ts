import { defineConfig } from 'tsup';
import { tsconfigPathsPlugin } from 'esbuild-plugin-tsconfig-paths';

export default defineConfig({
  entry: ['src/index.ts', 'src/utils/crypto.ts', 'src/utils/validation.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false, // Keep readable for library
  target: 'es2022',
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    };
  },
  esbuildPlugins: [tsconfigPathsPlugin()],
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
