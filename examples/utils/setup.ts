/**
 * Shared setup utilities for KSeF API v2 examples
 * 
 * This module provides:
 * - Environment variable validation
 * - Test certificate generation for local demos
 * - Prerequisite checking with helpful error messages
 */

import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import {
  CertificateType,
  type OfflineCertificate
} from '../../dist/index.js';

// Load environment variables from .env.examples if it exists
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.examples');
if (existsSync(envPath)) {
  config({ path: envPath });
}

/**
 * Environment configuration for examples
 */
export interface ExampleConfig {
  /** KSeF access token (required for API calls) */
  accessToken: string;
  /** Context NIP (required for API calls) */
  contextNip: string;
  /** Environment: 'test' | 'demo' | 'prod' (default: 'test') */
  environment: 'test' | 'demo' | 'prod';
  /** Path to sample invoice XML */
  invoicePath: string;
}

/**
 * Validation result for prerequisites
 */
export interface PrerequisiteCheck {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Check if all prerequisites for API examples are met
 */
export function checkApiPrerequisites(): PrerequisiteCheck {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env.KSEF_TOKEN) {
    missing.push('KSEF_TOKEN - Your KSeF API access token');
  }

  if (!process.env.KSEF_NIP) {
    missing.push('KSEF_NIP - Your context NIP (tax identification number)');
  }

  if (!process.env.KSEF_ENV) {
    warnings.push('KSEF_ENV not set, defaulting to "test"');
  } else if (!['test', 'demo', 'prod'].includes(process.env.KSEF_ENV)) {
    warnings.push(`KSEF_ENV="${process.env.KSEF_ENV}" is invalid, defaulting to "test"`);
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Get configuration from environment variables
 * Throws helpful error if prerequisites are not met
 */
export function getConfig(): ExampleConfig {
  const check = checkApiPrerequisites();

  if (!check.valid) {
    console.error('\n❌ Missing required environment variables:\n');
    check.missing.forEach(m => console.error(`   • ${m}`));
    console.error('\n📝 Setup instructions:');
    console.error('   1. Copy examples/env.examples.template to examples/.env.examples');
    console.error('   2. Fill in your KSeF credentials');
    console.error('   3. Run the example again\n');
    process.exit(1);
  }

  if (check.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    check.warnings.forEach(w => console.warn(`   • ${w}`));
    console.warn('');
  }

  const invoicePath = process.env.KSEF_INVOICE_PATH 
    || resolve(__dirname, '../sample-invoice.xml');

  if (!existsSync(invoicePath)) {
    console.error(`\n❌ Invoice file not found: ${invoicePath}`);
    console.error('   Set KSEF_INVOICE_PATH or ensure sample-invoice.xml exists\n');
    process.exit(1);
  }

  // Ensure we use a valid environment value
  const envValue = process.env.KSEF_ENV;
  const validEnv: 'test' | 'demo' | 'prod' = 
    envValue && ['test', 'demo', 'prod'].includes(envValue)
      ? (envValue as 'test' | 'demo' | 'prod')
      : 'test';

  return {
    accessToken: process.env.KSEF_TOKEN!,
    contextNip: process.env.KSEF_NIP!,
    environment: validEnv,
    invoicePath
  };
}

/**
 * Load invoice XML from file
 */
export function loadInvoiceXml(config: ExampleConfig): string {
  return readFileSync(config.invoicePath, 'utf8');
}

/**
 * Generate a test RSA key pair for local demos
 * These keys are for demonstration only - NOT for production use!
 */
export function generateTestRsaKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  console.log('🔐 Generating test RSA key pair (for demo purposes only)...');
  
  const keyPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  };
}

/**
 * Generate a test ECDSA P-256 key pair for local demos
 */
export function generateTestEcKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  console.log('🔐 Generating test ECDSA P-256 key pair (for demo purposes only)...');
  
  const keyPair = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey
  };
}

/**
 * Generate a test offline certificate for QR code demos
 * 
 * In production, you would load this from:
 * - A PKCS#12/PFX file
 * - An HSM (Hardware Security Module)
 * - A certificate file + private key file
 */
export function generateTestOfflineCertificate(): OfflineCertificate {
  console.log('📜 Generating test offline certificate (for demo purposes only)...');
  console.log('   ⚠️  In production, use a real certificate from a qualified provider!\n');

  const keyPair = generateTestRsaKeyPair();
  
  // Generate a random serial number (hex format)
  const serialNumber = randomBytes(8).toString('hex').toUpperCase();

  return {
    certificate: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    serialNumber,
    type: CertificateType.OFFLINE
  };
}

/**
 * Print example header with description
 */
export function printHeader(title: string, description: string): void {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(`${line}`);
  console.log(`\n${description}\n`);
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
  console.log(`\n✅ ${message}\n`);
}

/**
 * Print step indicator
 */
export function printStep(step: number, total: number, message: string): void {
  console.log(`[${step}/${total}] ${message}`);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Create a sample invoice date (today's date in ISO format)
 */
export function getTodayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

