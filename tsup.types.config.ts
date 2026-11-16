import { defineConfig } from 'tsup';

const entries = {
  index: 'src/index.ts',
  'utils/crypto': 'src/utils/crypto.ts',
  'utils/validation': 'src/utils/validation.ts',
};

// Separate declaration bundles keep namespace exports from referring to type-only
// symbols in shared chunks as runtime values. The JS build owns cleaning dist.
export default defineConfig(Object.entries(entries).map(([name, entry]) => ({
  entry: { [name]: entry },
  format: ['esm', 'cjs'],
  dts: { only: true, banner: '/// <reference types="node" />' },
  clean: false,
})));
