#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const OFFICIAL_ROOT = path.join(REPO_ROOT, 'ksef-official');
const LOCAL_OPENAPI_PATH = path.join(REPO_ROOT, 'docs/reference/ksef-api-v2-openapi.json');
const OFFICIAL_OPENAPI_PATH = path.join(OFFICIAL_ROOT, 'ksef-docs/open-api.json');
const TE_ADVISORY_OPERATION_PREFIXES = ['/testdata/'];
const REPORT_PATH = process.env.KSEF_OFFICIAL_REPORT_PATH
  ? path.resolve(REPO_ROOT, process.env.KSEF_OFFICIAL_REPORT_PATH)
  : null;

const OFFICIAL_REPOS = [
  {
    name: 'ksef-docs',
    url: 'https://github.com/CIRFMF/ksef-docs.git'
  },
  {
    name: 'ksef-client-csharp',
    url: 'https://github.com/CIRFMF/ksef-client-csharp.git'
  },
  {
    name: 'ksef-pdf-generator',
    url: 'https://github.com/CIRFMF/ksef-pdf-generator.git'
  }
];

const PROJECT_CHECKS = [
  {
    name: 'OpenAPI drift + coverage',
    command: 'pnpm',
    args: ['run', 'check:openapi']
  },
  {
    name: 'Build',
    command: 'pnpm',
    args: ['run', 'build']
  },
  {
    name: 'Unit tests',
    command: 'pnpm',
    args: ['run', 'test:unit']
  }
];

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function trimOutput(value) {
  return value.trim().split('\n').slice(-40).join('\n');
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, item]) => [key, canonicalize(item)]));
  }

  return value;
}

function stableJsonString(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function parseApiVersion(description) {
  if (typeof description !== 'string') {
    return 'unknown';
  }

  return description.match(/Wersja API:\*\* ([^<\n]+)/)?.[1] ?? 'unknown';
}

function countOperations(specJson) {
  let count = 0;

  for (const operationObject of Object.values(specJson.paths ?? {})) {
    if (!operationObject || typeof operationObject !== 'object') {
      continue;
    }

    for (const method of Object.keys(operationObject)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
        count += 1;
      }
    }
  }

  return count;
}

function normalizePath(pathValue) {
  const withNormalizedParams = pathValue.replace(/\{[^}]+\}/g, '{}');
  const withSingleSlashes = withNormalizedParams.replace(/\/+/g, '/');

  if (withSingleSlashes === '/') {
    return '/';
  }

  return withSingleSlashes.replace(/\/$/, '');
}

function parseSpecOperations(specJson) {
  const operations = new Set();

  for (const [pathKey, operationObject] of Object.entries(specJson.paths ?? {})) {
    if (!operationObject || typeof operationObject !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(operationObject)) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
        operations.add(`${method.toUpperCase()} ${normalizePath(pathKey)}`);
      }
    }
  }

  return operations;
}

function parseSpecOperationMap(specJson) {
  const operations = new Map();

  for (const [pathKey, operationObject] of Object.entries(specJson.paths ?? {})) {
    if (!operationObject || typeof operationObject !== 'object') {
      continue;
    }

    for (const [method, operation] of Object.entries(operationObject)) {
      if (!operation || typeof operation !== 'object') {
        continue;
      }

      if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method.toLowerCase())) {
        operations.set(`${method.toUpperCase()} ${normalizePath(pathKey)}`, operation);
      }
    }
  }

  return operations;
}

function difference(firstSet, secondSet) {
  return [...firstSet].filter((item) => !secondSet.has(item)).sort();
}

function isAdvisoryTeOperation(operationKey) {
  const [, pathPart] = operationKey.split(' ', 2);
  return TE_ADVISORY_OPERATION_PREFIXES.some((prefix) => pathPart.startsWith(prefix));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      env: process.env,
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('close', (code) => {
      resolve({
        command: formatCommand(command, args),
        code: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

async function runGit(repoPath, args) {
  return await run('git', args, { cwd: repoPath });
}

async function gitOutput(repoPath, args) {
  const result = await runGit(repoPath, args);
  return result.code === 0 ? result.stdout.trim() : '';
}

async function cloneOfficialRepo(repo) {
  await fs.mkdir(OFFICIAL_ROOT, { recursive: true });
  const result = await run('git', ['clone', repo.url, path.join(OFFICIAL_ROOT, repo.name)], { cwd: REPO_ROOT });
  return {
    cloned: result.code === 0,
    error: result.code === 0 ? null : trimOutput(`${result.stdout}\n${result.stderr}`)
  };
}

async function updateOfficialRepo(repo) {
  const repoPath = path.join(OFFICIAL_ROOT, repo.name);
  const gitDir = path.join(repoPath, '.git');

  if (!(await pathExists(gitDir))) {
    const cloneResult = await cloneOfficialRepo(repo);
    if (!cloneResult.cloned) {
      return {
        ...repo,
        path: repoPath,
        updated: false,
        skipped: true,
        reason: cloneResult.error,
        commits: [],
        changedFiles: []
      };
    }
  }

  const before = await gitOutput(repoPath, ['rev-parse', 'HEAD']);
  const branch = await gitOutput(repoPath, ['branch', '--show-current']);
  const status = await gitOutput(repoPath, ['status', '--porcelain']);
  const upstream = await gitOutput(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const remoteRef = upstream || (branch ? `origin/${branch}` : 'origin/main');
  const fetchResult = await runGit(repoPath, ['fetch', '--prune', 'origin']);

  if (fetchResult.code !== 0) {
    return {
      ...repo,
      path: repoPath,
      before,
      after: before,
      updated: false,
      skipped: true,
      reason: trimOutput(`${fetchResult.stdout}\n${fetchResult.stderr}`),
      commits: [],
      changedFiles: []
    };
  }

  const remoteSha = await gitOutput(repoPath, ['rev-parse', remoteRef]);
  let after = before;
  let mergeSkippedReason = null;

  if (remoteSha && before !== remoteSha) {
    if (status) {
      mergeSkippedReason = 'local working tree is dirty; fetched only';
    } else {
      const mergeResult = await runGit(repoPath, ['merge', '--ff-only', remoteRef]);
      if (mergeResult.code === 0) {
        after = await gitOutput(repoPath, ['rev-parse', 'HEAD']);
      } else {
        mergeSkippedReason = trimOutput(`${mergeResult.stdout}\n${mergeResult.stderr}`);
      }
    }
  }

  const changedRange = before && after && before !== after ? `${before}..${after}` : null;
  const commits = changedRange
    ? (await gitOutput(repoPath, ['log', '--oneline', '--decorate=no', changedRange])).split('\n').filter(Boolean)
    : (await gitOutput(repoPath, ['log', '--oneline', '--decorate=no', '-5'])).split('\n').filter(Boolean);
  const changedFiles = changedRange
    ? (await gitOutput(repoPath, ['diff', '--name-status', changedRange])).split('\n').filter(Boolean)
    : [];

  return {
    ...repo,
    path: repoPath,
    branch,
    before,
    after,
    remoteRef,
    remoteSha,
    updated: Boolean(changedRange),
    skipped: Boolean(mergeSkippedReason),
    reason: mergeSkippedReason,
    commits,
    changedFiles
  };
}

async function runProjectChecks() {
  const checks = [];

  for (const check of PROJECT_CHECKS) {
    const result = await run(check.command, check.args);
    checks.push({
      ...check,
      commandText: formatCommand(check.command, check.args),
      code: result.code,
      output: trimOutput(`${result.stdout}\n${result.stderr}`)
    });
  }

  return checks;
}

async function compareOpenApiSpecs() {
  if (!(await pathExists(LOCAL_OPENAPI_PATH)) || !(await pathExists(OFFICIAL_OPENAPI_PATH))) {
    return null;
  }

  const localSpec = await readJson(LOCAL_OPENAPI_PATH);
  const officialSpec = await readJson(OFFICIAL_OPENAPI_PATH);
  const localCanonical = stableJsonString(localSpec);
  const officialCanonical = stableJsonString(officialSpec);
  const localOperationMap = parseSpecOperationMap(localSpec);
  const officialOperationMap = parseSpecOperationMap(officialSpec);
  const localOperations = new Set(localOperationMap.keys());
  const officialOperations = new Set(officialOperationMap.keys());
  const officialOnlyOperations = difference(officialOperations, localOperations);
  const localOnlyOperations = difference(localOperations, officialOperations);
  const officialOnlyAdvisoryOperations = officialOnlyOperations.filter(isAdvisoryTeOperation);
  const officialOnlyNonAdvisoryOperations = officialOnlyOperations.filter((operation) => !isAdvisoryTeOperation(operation));
  const commonOperationDiffs = [...localOperations].sort()
    .filter((operation) => officialOperationMap.has(operation))
    .filter((operation) => stableJsonString(localOperationMap.get(operation)) !== stableJsonString(officialOperationMap.get(operation)));

  return {
    equal: localCanonical === officialCanonical,
    mode: 'TR primary, TE advisory',
    local: {
      title: localSpec.info?.title ?? 'unknown',
      apiVersion: parseApiVersion(localSpec.info?.description),
      pathCount: Object.keys(localSpec.paths ?? {}).length,
      operationCount: countOperations(localSpec),
      sha: sha256(localCanonical)
    },
    official: {
      title: officialSpec.info?.title ?? 'unknown',
      apiVersion: parseApiVersion(officialSpec.info?.description),
      pathCount: Object.keys(officialSpec.paths ?? {}).length,
      operationCount: countOperations(officialSpec),
      sha: sha256(officialCanonical)
    },
    officialOnlyOperations,
    localOnlyOperations,
    officialOnlyAdvisoryOperations,
    officialOnlyNonAdvisoryOperations,
    commonOperationDiffs
  };
}

function buildSuggestions(repoResults, checks, openApiComparison) {
  const suggestions = [];
  const failedChecks = checks.filter((check) => check.code !== 0);
  const docsChangedFiles = repoResults
    .find((repo) => repo.name === 'ksef-docs')
    ?.changedFiles.map((entry) => entry.replace(/^[A-Z]\s+/, '')) ?? [];

  if (failedChecks.some((check) => check.name === 'OpenAPI drift + coverage')) {
    suggestions.push('OpenAPI drift is active: run `pnpm run update:openapi`, inspect the snapshot diff, then update routes/types/services/tests if coverage starts failing.');
  }

  if (openApiComparison && !openApiComparison.equal) {
    if (
      openApiComparison.localOnlyOperations.length === 0 &&
      openApiComparison.officialOnlyNonAdvisoryOperations.length === 0 &&
      openApiComparison.commonOperationDiffs.length === 0 &&
      openApiComparison.officialOnlyAdvisoryOperations.length > 0
    ) {
      suggestions.push('TR/demo remains the primary OpenAPI contract; current TE-only operation differences are advisory `/testdata/*` endpoints and do not require copying `ksef-docs/open-api.json` into the integrator.');
    } else {
      suggestions.push('TR/demo and TE OpenAPI differ outside advisory `/testdata/*` operations; review shared endpoint/model changes before accepting the drift.');
    }
  }

  if (docsChangedFiles.some((file) => file === 'api-changelog.md' || file === 'open-api.json')) {
    suggestions.push('Official docs changed API contract/changelog files; review `api-changelog.md`, `open-api.json`, and adjust API v2 models or endpoint coverage where needed.');
  }

  if (repoResults.some((repo) => repo.name === 'ksef-client-csharp' && repo.changedFiles.some((file) => /Models|Api|Builders|Endpoints|types/i.test(file)))) {
    suggestions.push('Official client implementation changed model/API/builder files; compare affected request/response DTOs against `src/api2/types` and service methods.');
  }

  if (repoResults.some((repo) => repo.name === 'ksef-pdf-generator' && repo.updated)) {
    suggestions.push('Official PDF generator changed; review only if this project depends on generated invoice/UPO rendering behavior.');
  }

  if (failedChecks.some((check) => check.name === 'Build')) {
    suggestions.push('Project build failed; fix TypeScript or declaration generation before aligning behavioral changes.');
  }

  if (failedChecks.some((check) => check.name === 'Unit tests')) {
    suggestions.push('Unit tests failed; inspect failing tests before accepting any OpenAPI or official-client alignment changes.');
  }

  if (suggestions.length === 0) {
    suggestions.push('No immediate integrator changes suggested by this run.');
  }

  return suggestions;
}

function renderReport(repoResults, checks, openApiComparison, suggestions) {
  const lines = [
    '# KSeF Official State Check',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Official repositories'
  ];

  for (const repo of repoResults) {
    lines.push('', `### ${repo.name}`);
    lines.push(`- Path: ${path.relative(REPO_ROOT, repo.path)}`);
    lines.push(`- Remote: ${repo.url}`);
    lines.push(`- Branch: ${repo.branch || 'unknown'}`);
    lines.push(`- Updated: ${repo.updated ? 'yes' : 'no'}`);
    if (repo.skipped) {
      lines.push(`- Update note: ${repo.reason}`);
    }
    if (repo.updated) {
      lines.push('- Pulled commits:');
    } else {
      lines.push('- Latest commits:');
    }
    for (const commit of repo.commits.slice(0, 10)) {
      lines.push(`  - ${commit}`);
    }
    if (repo.changedFiles.length > 0) {
      lines.push('- Changed files:');
      for (const file of repo.changedFiles.slice(0, 30)) {
        lines.push(`  - ${file}`);
      }
    }
  }

  lines.push('', '## Integrator checks');
  for (const check of checks) {
    lines.push('', `### ${check.name}`);
    lines.push(`- Command: \`${check.commandText}\``);
    lines.push(`- Exit code: ${check.code}`);
    if (check.code !== 0 && check.output) {
      lines.push('', '```text', check.output, '```');
    }
  }

  if (openApiComparison) {
    lines.push('', '## OpenAPI comparison');
    lines.push(`- Mode: ${openApiComparison.mode}`);
    lines.push(`- Local: ${openApiComparison.local.title}, ${openApiComparison.local.apiVersion}, paths ${openApiComparison.local.pathCount}, operations ${openApiComparison.local.operationCount}, sha ${openApiComparison.local.sha}`);
    lines.push(`- Official docs advisory: ${openApiComparison.official.title}, ${openApiComparison.official.apiVersion}, paths ${openApiComparison.official.pathCount}, operations ${openApiComparison.official.operationCount}, sha ${openApiComparison.official.sha}`);
    lines.push(`- Canonical JSON equal: ${openApiComparison.equal ? 'yes' : 'no'}`);
    lines.push(`- TE-only advisory operations: ${openApiComparison.officialOnlyAdvisoryOperations.length}`);
    for (const operation of openApiComparison.officialOnlyAdvisoryOperations.slice(0, 30)) {
      lines.push(`  - ${operation}`);
    }
    lines.push(`- TE-only non-advisory operations: ${openApiComparison.officialOnlyNonAdvisoryOperations.length}`);
    for (const operation of openApiComparison.officialOnlyNonAdvisoryOperations.slice(0, 30)) {
      lines.push(`  - ${operation}`);
    }
    lines.push(`- Local-only operations: ${openApiComparison.localOnlyOperations.length}`);
    for (const operation of openApiComparison.localOnlyOperations.slice(0, 30)) {
      lines.push(`  - ${operation}`);
    }
    lines.push(`- Common operation definition diffs: ${openApiComparison.commonOperationDiffs.length}`);
    for (const operation of openApiComparison.commonOperationDiffs.slice(0, 30)) {
      lines.push(`  - ${operation}`);
    }
  }

  lines.push('', '## Suggested follow-up');
  for (const suggestion of suggestions) {
    lines.push(`- ${suggestion}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const repoResults = [];

  for (const repo of OFFICIAL_REPOS) {
    repoResults.push(await updateOfficialRepo(repo));
  }

  const [checks, openApiComparison] = await Promise.all([
    runProjectChecks(),
    compareOpenApiSpecs()
  ]);
  const suggestions = buildSuggestions(repoResults, checks, openApiComparison);
  const report = renderReport(repoResults, checks, openApiComparison, suggestions);

  if (REPORT_PATH) {
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, report);
  }

  process.stdout.write(report);

  if (checks.some((check) => check.code !== 0)) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
