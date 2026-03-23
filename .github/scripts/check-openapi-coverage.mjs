#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
const DEFAULT_UPSTREAM_SPEC_URL = 'https://api-demo.ksef.mf.gov.pl/docs/v2/openapi.json';

const REPO_ROOT = process.cwd();
const LOCAL_SPEC_PATH = path.join(REPO_ROOT, 'docs/reference/ksef-api-v2-openapi.json');
const ROUTES_PATH = path.join(REPO_ROOT, 'src/api2/routes.ts');
const SERVICES_DIR = path.join(REPO_ROOT, 'src/api2/services');
const EXTRA_OPERATION_FILES = [path.join(REPO_ROOT, 'src/api2/security.ts')];
const SPEC_EXCLUDED_PREFIXES = ['/testdata/'];

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

function normalizePath(pathValue) {
  const withNormalizedParams = pathValue.replace(/\{[^}]+\}/g, '{}');
  const withSingleSlashes = withNormalizedParams.replace(/\/+/g, '/');

  if (withSingleSlashes === '/') {
    return '/';
  }

  return withSingleSlashes.replace(/\/$/, '');
}

function unwrapExpression(node) {
  let current = node;

  while (
    ts.isAsExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

function getPropertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return null;
}

function extractPathExpression(node) {
  const expression = unwrapExpression(node);

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (ts.isTemplateExpression(expression)) {
    let result = expression.head.text;
    for (const span of expression.templateSpans) {
      result += `{}`;
      result += span.literal.text;
    }
    return result;
  }

  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = extractPathExpression(expression.left);
    const right = extractPathExpression(expression.right);

    if (left !== null && right !== null) {
      return `${left}${right}`;
    }
  }

  return null;
}

function extractFunctionBodyExpression(node) {
  const body = unwrapExpression(node.body);

  if (ts.isBlock(body)) {
    for (const statement of body.statements) {
      if (ts.isReturnStatement(statement) && statement.expression) {
        return statement.expression;
      }
    }

    return null;
  }

  return body;
}

function collectRouteDefinitions(prefix, objectLiteral, routeMap) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const propertyName = getPropertyName(property.name);
    if (!propertyName) {
      continue;
    }

    const routeName = `${prefix}.${propertyName}`;
    const initializer = unwrapExpression(property.initializer);

    if (ts.isObjectLiteralExpression(initializer)) {
      collectRouteDefinitions(routeName, initializer, routeMap);
      continue;
    }

    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
      const bodyExpression = extractFunctionBodyExpression(initializer);
      if (!bodyExpression) {
        continue;
      }

      const routePath = extractPathExpression(bodyExpression);
      if (routePath !== null) {
        routeMap.set(routeName, normalizePath(routePath));
      }

      continue;
    }

    const routePath = extractPathExpression(initializer);
    if (routePath !== null) {
      routeMap.set(routeName, normalizePath(routePath));
    }
  }
}

function parseRoutesMap(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const routeMap = new Map();
  let foundRoutesObject = false;

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'Routes' && node.initializer) {
      const initializer = unwrapExpression(node.initializer);

      if (ts.isObjectLiteralExpression(initializer)) {
        foundRoutesObject = true;
        collectRouteDefinitions('Routes', initializer, routeMap);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!foundRoutesObject) {
    throw new Error(`Could not find Routes object in ${filePath}`);
  }

  return routeMap;
}

function getRouteChain(node) {
  if (ts.isIdentifier(node)) {
    return node.text === 'Routes' ? 'Routes' : null;
  }

  if (ts.isPropertyAccessExpression(node)) {
    const parent = getRouteChain(node.expression);
    if (!parent) {
      return null;
    }

    return `${parent}.${node.name.text}`;
  }

  return null;
}

function collectMethodVariableInitializers(methodNode) {
  const variableMap = new Map();

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variableMap.set(node.name.text, node.initializer);
    }

    ts.forEachChild(node, visit);
  }

  if (methodNode.body) {
    visit(methodNode.body);
  }

  return variableMap;
}

function collectRouteReferences(expression, routeMap, variableMap, refs, resolvingIdentifiers = new Set()) {
  const resolvedExpression = unwrapExpression(expression);

  if (ts.isIdentifier(resolvedExpression) && variableMap.has(resolvedExpression.text)) {
    if (!resolvingIdentifiers.has(resolvedExpression.text)) {
      resolvingIdentifiers.add(resolvedExpression.text);
      collectRouteReferences(
        variableMap.get(resolvedExpression.text),
        routeMap,
        variableMap,
        refs,
        resolvingIdentifiers
      );
      resolvingIdentifiers.delete(resolvedExpression.text);
    }
    return;
  }

  if (ts.isCallExpression(resolvedExpression)) {
    const routeChain = getRouteChain(resolvedExpression.expression);
    if (routeChain && routeMap.has(routeChain)) {
      refs.add(routeChain);
    }
  }

  if (ts.isPropertyAccessExpression(resolvedExpression)) {
    const routeChain = getRouteChain(resolvedExpression);
    if (routeChain && routeMap.has(routeChain)) {
      refs.add(routeChain);
    }
  }

  ts.forEachChild(resolvedExpression, (child) => {
    collectRouteReferences(child, routeMap, variableMap, refs, resolvingIdentifiers);
  });
}

function readRequestDescriptorFromObjectLiteral(objectLiteral) {
  let method = null;
  let urlExpression = null;

  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property)) {
      const propertyName = getPropertyName(property.name);
      if (propertyName === 'method') {
        const methodExpression = unwrapExpression(property.initializer);
        if (ts.isStringLiteral(methodExpression) || ts.isNoSubstitutionTemplateLiteral(methodExpression)) {
          method = methodExpression.text.toUpperCase();
        }
      }

      if (propertyName === 'url') {
        urlExpression = property.initializer;
      }
    }

    if (ts.isShorthandPropertyAssignment(property) && property.name.text === 'url') {
      urlExpression = property.name;
    }
  }

  return { method, urlExpression };
}

function resolveRequestOptionsObject(node, variableMap) {
  if (ts.isObjectLiteralExpression(node)) {
    return node;
  }

  if (ts.isIdentifier(node) && variableMap.has(node.text)) {
    const initializer = unwrapExpression(variableMap.get(node.text));
    if (ts.isObjectLiteralExpression(initializer)) {
      return initializer;
    }
  }

  return null;
}

function collectRequestCalls(blockNode, variableMap = new Map()) {
  const requestCalls = [];

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'request') {
      const [firstArgument] = node.arguments;
      if (firstArgument) {
        const requestOptions = resolveRequestOptionsObject(firstArgument, variableMap);
        if (!requestOptions) {
          ts.forEachChild(node, visit);
          return;
        }

        const descriptor = readRequestDescriptorFromObjectLiteral(requestOptions);
        if (descriptor.method && descriptor.urlExpression) {
          requestCalls.push(descriptor);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(blockNode);

  return requestCalls;
}

function collectHelperSignatures(classNode) {
  const helperSignatures = new Map();

  for (const member of classNode.members) {
    if (!ts.isMethodDeclaration(member) || !member.body || !member.name || !ts.isIdentifier(member.name)) {
      continue;
    }

    const methodName = member.name.text;
    const variableMap = collectMethodVariableInitializers(member);
    const requestCalls = collectRequestCalls(member.body, variableMap);

    for (const requestCall of requestCalls) {
      if (!ts.isIdentifier(requestCall.urlExpression)) {
        continue;
      }

      const parameterIndex = member.parameters.findIndex((parameter) => {
        return ts.isIdentifier(parameter.name) && parameter.name.text === requestCall.urlExpression.text;
      });

      if (parameterIndex !== -1) {
        helperSignatures.set(methodName, {
          method: requestCall.method,
          urlArgumentIndex: parameterIndex
        });
      }
    }
  }

  return helperSignatures;
}

function collectThisMethodInvocations(blockNode) {
  const invocations = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isThis(node.expression.expression)
    ) {
      invocations.push({
        methodName: node.expression.name.text,
        arguments: node.arguments
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(blockNode);

  return invocations;
}

function parseOperationsFromSource(sourceText, filePath, routeMap) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const operations = new Set();

  function addOperation(method, routeReference) {
    const routePath = routeMap.get(routeReference);
    if (!routePath) {
      return;
    }

    operations.add(`${method.toUpperCase()} ${routePath}`);
  }

  function visit(node) {
    if (!ts.isClassDeclaration(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const helperSignatures = collectHelperSignatures(node);

    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body) {
        continue;
      }

      const variableMap = collectMethodVariableInitializers(member);
      const requestCalls = collectRequestCalls(member.body, variableMap);

      for (const requestCall of requestCalls) {
        const routeReferences = new Set();
        collectRouteReferences(requestCall.urlExpression, routeMap, variableMap, routeReferences);

        for (const routeReference of routeReferences) {
          addOperation(requestCall.method, routeReference);
        }
      }

      const invocations = collectThisMethodInvocations(member.body);

      for (const invocation of invocations) {
        const helperSignature = helperSignatures.get(invocation.methodName);
        if (!helperSignature) {
          continue;
        }

        const routeExpression = invocation.arguments[helperSignature.urlArgumentIndex];
        if (!routeExpression) {
          continue;
        }

        const routeReferences = new Set();
        collectRouteReferences(routeExpression, routeMap, variableMap, routeReferences);

        for (const routeReference of routeReferences) {
          addOperation(helperSignature.method, routeReference);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return operations;
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

      const normalizedMethod = method.toLowerCase();
      if (!HTTP_METHODS.has(normalizedMethod)) {
        continue;
      }

      operations.add(`${normalizedMethod.toUpperCase()} ${normalizePath(pathKey)}`);
    }
  }

  return operations;
}

function difference(firstSet, secondSet) {
  return [...firstSet].filter((item) => !secondSet.has(item)).sort();
}

function isSpecExcludedOperation(operationKey) {
  const [, pathPart] = operationKey.split(' ', 2);
  return SPEC_EXCLUDED_PREFIXES.some((prefix) => pathPart.startsWith(prefix));
}

async function listServiceFiles() {
  const entries = await fs.readdir(SERVICES_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => path.join(SERVICES_DIR, entry.name))
    .sort();

  for (const extraFile of EXTRA_OPERATION_FILES) {
    files.push(extraFile);
  }

  return files;
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000)
  });

  if (!response.ok) {
    throw new Error(`Failed to download upstream spec: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function main() {
  const upstreamSpecUrl = process.env.KSEF_OPENAPI_UPSTREAM_URL ?? DEFAULT_UPSTREAM_SPEC_URL;

  const [localSpecJson, upstreamSpecJson, routesSourceText, serviceFiles] = await Promise.all([
    loadJson(LOCAL_SPEC_PATH),
    fetchJson(upstreamSpecUrl),
    fs.readFile(ROUTES_PATH, 'utf8'),
    listServiceFiles()
  ]);

  const localSpecCanonical = stableJsonString(localSpecJson);
  const upstreamSpecCanonical = stableJsonString(upstreamSpecJson);

  if (localSpecCanonical !== upstreamSpecCanonical) {
    throw new Error([
      `OpenAPI drift detected between local snapshot and upstream source.`,
      `Upstream URL: ${upstreamSpecUrl}`,
      `Local file: ${LOCAL_SPEC_PATH}`,
      `Local SHA256: ${sha256(localSpecCanonical)}`,
      `Upstream SHA256: ${sha256(upstreamSpecCanonical)}`,
      '',
      `Refresh command:`,
      `curl -fsSL ${upstreamSpecUrl} -o docs/reference/ksef-api-v2-openapi.json`
    ].join('\n'));
  }

  const routeMap = parseRoutesMap(routesSourceText, ROUTES_PATH);
  const implementationOperations = new Set();

  for (const filePath of serviceFiles) {
    const sourceText = await fs.readFile(filePath, 'utf8');
    const fileOperations = parseOperationsFromSource(sourceText, filePath, routeMap);

    for (const operation of fileOperations) {
      implementationOperations.add(operation);
    }
  }

  const specOperations = parseSpecOperations(localSpecJson);
  const implementationNotInSpec = difference(implementationOperations, specOperations)
    .filter((operation) => !isSpecExcludedOperation(operation));
  const specNotInImplementation = difference(specOperations, implementationOperations);

  if (implementationNotInSpec.length > 0 || specNotInImplementation.length > 0) {
    const lines = [
      'OpenAPI operation coverage mismatch detected.',
      `Spec operations: ${specOperations.size}`,
      `Implemented operations: ${implementationOperations.size}`,
      ''
    ];

    if (implementationNotInSpec.length > 0) {
      lines.push('Implemented operations missing from spec:');
      for (const operation of implementationNotInSpec) {
        lines.push(`  - ${operation}`);
      }
      lines.push('');
    }

    if (specNotInImplementation.length > 0) {
      lines.push('Spec operations missing from implementation:');
      for (const operation of specNotInImplementation) {
        lines.push(`  - ${operation}`);
      }
      lines.push('');
    }

    throw new Error(lines.join('\n'));
  }

  console.log(
    `OpenAPI guard passed: ${specOperations.size} operations in sync (source: ${upstreamSpecUrl}).`
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
