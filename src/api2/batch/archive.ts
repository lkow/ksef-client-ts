import { gzipSync, constants as zlibConstants } from 'node:zlib';
import type { BatchInvoiceInput, BatchManifestItem } from './types.js';
import { sha256Base64 } from './crypto.js';

export function buildManifest(invoices: BatchInvoiceInput[]): BatchManifestItem[] {
  return invoices.map((invoice) => {
    const invoiceBuffer = toBuffer(invoice.xml);
    return {
      localId: invoice.localId,
      fileName: normalizeTarFileName(invoice.fileName),
      invoiceHash: sha256Base64(invoiceBuffer),
      invoiceSize: invoiceBuffer.byteLength
    };
  });
}

export function buildTarGz(invoices: BatchInvoiceInput[]): Buffer {
  const tarEntries: Buffer[] = [];

  for (const invoice of invoices) {
    const fileName = normalizeTarFileName(invoice.fileName);
    const content = toBuffer(invoice.xml);
    tarEntries.push(createTarHeader(fileName, content.byteLength));
    tarEntries.push(content);
    const padding = (512 - (content.byteLength % 512)) % 512;
    if (padding > 0) {
      tarEntries.push(Buffer.alloc(padding));
    }
  }

  tarEntries.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(tarEntries), {
    level: zlibConstants.Z_BEST_COMPRESSION
  });
}

function createTarHeader(fileName: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(fileName, 0, 100, 'utf8');
  writeTarOctal(header, 0o644, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  const checksumValue = checksum.toString(8).padStart(6, '0');
  header.write(`${checksumValue}\0 `, 148, 8, 'ascii');
  return header;
}

function writeTarOctal(header: Buffer, value: number, offset: number, length: number): void {
  const valueString = value.toString(8);
  if (valueString.length > length - 1) {
    throw new Error(`Tar header value ${value} does not fit in ${length} bytes`);
  }
  header.write(`${valueString.padStart(length - 1, '0')}\0`, offset, length, 'ascii');
}

function toBuffer(value: string | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
}

function normalizeTarFileName(fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..') || normalized.includes('\0')) {
    throw new Error(`Invalid invoice fileName: ${fileName}`);
  }
  if (Buffer.byteLength(normalized, 'utf8') > 100) {
    throw new Error(`Invoice fileName is too long for the built-in tar writer: ${fileName}`);
  }
  return normalized;
}
