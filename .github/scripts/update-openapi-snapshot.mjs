#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_UPSTREAM_SPEC_URL = 'https://api-demo.ksef.mf.gov.pl/docs/v2/openapi.json';

const REPO_ROOT = process.cwd();
const LOCAL_SPEC_PATH = path.join(REPO_ROOT, 'docs/reference/ksef-api-v2-openapi.json');

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    throw new Error(`Failed to download upstream spec: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function validateOpenApiSpec(specJson, sourceUrl) {
  if (!specJson || typeof specJson !== 'object') {
    throw new Error(`Downloaded OpenAPI spec is not a JSON object: ${sourceUrl}`);
  }

  if (typeof specJson.openapi !== 'string' || !specJson.paths || typeof specJson.paths !== 'object') {
    throw new Error(`Downloaded JSON does not look like an OpenAPI document: ${sourceUrl}`);
  }
}

async function main() {
  const upstreamSpecUrl = process.env.KSEF_OPENAPI_UPSTREAM_URL ?? DEFAULT_UPSTREAM_SPEC_URL;
  const upstreamSpecJson = await fetchJson(upstreamSpecUrl);
  validateOpenApiSpec(upstreamSpecJson, upstreamSpecUrl);

  await fs.mkdir(path.dirname(LOCAL_SPEC_PATH), { recursive: true });
  await fs.writeFile(LOCAL_SPEC_PATH, `${JSON.stringify(upstreamSpecJson, null, 2)}\n`);

  console.log(`Updated ${path.relative(REPO_ROOT, LOCAL_SPEC_PATH)} from ${upstreamSpecUrl}.`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
