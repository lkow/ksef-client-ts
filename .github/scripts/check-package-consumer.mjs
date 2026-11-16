#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtureRoot = path.join(repoRoot, '.github/fixtures/package-consumer');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'ksef-package-consumer-'));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
}

try {
  const tarball = path.join(temporaryRoot, 'client.tgz');
  run('pnpm', ['--config.ignore-scripts=true', 'pack', '--out', tarball], repoRoot);
  const consumerRoot = path.join(temporaryRoot, 'consumer');
  await cp(fixtureRoot, consumerRoot, { recursive: true });
  await writeFile(path.join(consumerRoot, 'package.json'), JSON.stringify({
    name: 'ksef-package-consumer',
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: { '@ksef/client': `file:${tarball}` }
  }));
  await writeFile(path.join(consumerRoot, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: false,
      noEmit: true
    },
    include: ['*.mts', '*.cts']
  }));
  // Install only what the published package provides, without SDK devDependencies.
  run('pnpm', ['install', '--ignore-scripts', '--ignore-workspace'], consumerRoot);
  const tsc = require.resolve('typescript/bin/tsc');
  const ts = require('typescript');
  for (const [extension, mode] of [['mts', ts.ModuleKind.ESNext], ['cts', ts.ModuleKind.CommonJS]]) {
    for (const entry of ['@ksef/client', '@ksef/client/crypto', '@ksef/client/validation']) {
      const resolved = ts.resolveModuleName(entry, path.join(consumerRoot, `index.${extension}`),
        { moduleResolution: ts.ModuleResolutionKind.NodeNext }, ts.sys, undefined, undefined, mode);
      assert.ok(resolved.resolvedModule?.resolvedFileName.endsWith(`.d.${extension === 'mts' ? 'ts' : 'cts'}`),
        `${entry} must resolve to declarations for ${extension}`);
    }
  }
  run(process.execPath, [tsc, '-p', 'tsconfig.json'], consumerRoot);
  // Each entrypoint must provide its own type dependencies, independently of the others.
  for (const entry of ['@ksef/client', '@ksef/client/crypto', '@ksef/client/validation']) {
    const source = `import * as sdk from '${entry}';\nvoid sdk;\n`;
    await writeFile(path.join(consumerRoot, 'entry.mts'), source);
    await writeFile(path.join(consumerRoot, 'entry.cts'), source);
    run(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', 'false',
      '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
      'entry.mts', 'entry.cts'], consumerRoot);
  }
  run(process.execPath, ['smoke.mjs'], consumerRoot);
  console.log('Packed SDK consumer passed: strict ESM/CJS declarations and runtime exports.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
