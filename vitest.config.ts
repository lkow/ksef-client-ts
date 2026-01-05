import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      'node_modules/**',
      'dist/**',
      'ksef-official/**',
      'scripts/**',
      'examples/**',
      'docs/**',
      'src/assets/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'ksef-official/**',
        'scripts/**',
        'examples/**',
        'docs/**',
        'src/assets/**',
        '**/*.d.ts',
        '**/*.config.*',
        'src/types/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
}); 
