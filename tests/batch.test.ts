import { describe, it, expect, vi } from 'vitest';
import { createDecipheriv, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import {
  BatchFileBuilder,
  KsefBatchService,
  sha256Base64,
  type PreparedBatch
} from '../src/api2/batch.js';
import type { SymmetricKeyMaterial } from '../src/api2/crypto/symmetric.js';
import type { SessionInvoiceStatus } from '../src/api2/types/session.js';

const formCode = { systemCode: 'FA (3)', schemaVersion: '1-0E', value: 'FA' } as const;

function createTestMaterial(): SymmetricKeyMaterial {
  const initializationVector = randomBytes(16);
  return {
    symmetricKey: randomBytes(32),
    initializationVector,
    encryptedSymmetricKey: 'encrypted-key',
    initializationVectorBase64: initializationVector.toString('base64')
  };
}

function decryptPart(part: Buffer, material: SymmetricKeyMaterial): Buffer {
  const decipher = createDecipheriv('aes-256-cbc', material.symmetricKey, material.initializationVector);
  return Buffer.concat([decipher.update(part), decipher.final()]);
}

function createBatchService(sessions: any = {}, uploader: any = {}) {
  return new KsefBatchService(
    sessions,
    uploader,
    {} as any,
    'test'
  );
}

describe('sha256Base64', () => {
  it('produces correct SHA-256 hash for known input', () => {
    const input = Buffer.from('test', 'utf8');
    // SHA-256 of "test"
    const expected = 'n4bQgYhMfWWaL+qgxVrQFaO/TxsrC4Is0V1sFbDwCgg=';
    expect(sha256Base64(input)).toBe(expected);
  });

  it('produces correct hash for empty buffer', () => {
    const input = Buffer.alloc(0);
    // SHA-256 of empty
    const expected = '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
    expect(sha256Base64(input)).toBe(expected);
  });
});

describe('BatchFileBuilder', () => {
  describe('build', () => {
    it('builds single part for small files', () => {
      const data = Buffer.from('small file content');
      const builder = new BatchFileBuilder(data);
      const result = builder.build();

      expect(result.parts).toHaveLength(1);
      expect(result.batchFile.fileParts).toHaveLength(1);
      expect(result.parts[0]).toEqual(data);
    });

    it('computes correct total file hash', () => {
      const data = Buffer.from('test content for hashing');
      const builder = new BatchFileBuilder(data);
      const result = builder.build();

      const expectedHash = sha256Base64(data);
      expect(result.batchFile.fileHash).toBe(expectedHash);
    });

    it('computes correct total file size', () => {
      const data = Buffer.from('test content');
      const builder = new BatchFileBuilder(data);
      const result = builder.build();

      expect(result.batchFile.fileSize).toBe(data.byteLength);
    });

    it('includes compression type when requested', () => {
      const data = Buffer.from('test content');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(undefined, { compressionType: 'TarGz' });

      expect(result.batchFile.compressionType).toBe('TarGz');
    });

    it('splits file into multiple parts at correct boundaries', () => {
      // Create a 25-byte buffer and split into 10-byte parts
      const data = Buffer.alloc(25, 'x');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      expect(result.parts).toHaveLength(3);
      expect(result.parts[0].byteLength).toBe(10);
      expect(result.parts[1].byteLength).toBe(10);
      expect(result.parts[2].byteLength).toBe(5);
    });

    it('computes correct hashes for each part', () => {
      const data = Buffer.alloc(25, 'y');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      result.parts.forEach((part, index) => {
        const expectedHash = sha256Base64(part);
        expect(result.batchFile.fileParts[index].fileHash).toBe(expectedHash);
      });
    });

    it('assigns correct ordinal numbers', () => {
      const data = Buffer.alloc(30, 'z');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      expect(result.batchFile.fileParts[0].ordinalNumber).toBe(1);
      expect(result.batchFile.fileParts[1].ordinalNumber).toBe(2);
      expect(result.batchFile.fileParts[2].ordinalNumber).toBe(3);
    });

    it('respects custom partSize parameter', () => {
      const data = Buffer.alloc(100, 'a');
      const builder = new BatchFileBuilder(data);
      
      const result20 = builder.build(20);
      expect(result20.parts).toHaveLength(5);

      const result50 = builder.build(50);
      expect(result50.parts).toHaveLength(2);
    });

    it('uses default 5MB part size', () => {
      const fiveMB = 5 * 1024 * 1024;
      const data = Buffer.alloc(fiveMB + 1000, 'b');
      const builder = new BatchFileBuilder(data);
      const result = builder.build();

      expect(result.parts).toHaveLength(2);
      expect(result.parts[0].byteLength).toBe(fiveMB);
      expect(result.parts[1].byteLength).toBe(1000);
    });

    it('sets correct file size for each part', () => {
      const data = Buffer.alloc(25, 'c');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      expect(result.batchFile.fileParts[0].fileSize).toBe(10);
      expect(result.batchFile.fileParts[1].fileSize).toBe(10);
      expect(result.batchFile.fileParts[2].fileSize).toBe(5);
    });

    it('handles exact part size boundary', () => {
      const data = Buffer.alloc(30, 'd');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      expect(result.parts).toHaveLength(3);
      result.parts.forEach(part => {
        expect(part.byteLength).toBe(10);
      });
    });

    it('handles single byte file', () => {
      const data = Buffer.from([0x42]);
      const builder = new BatchFileBuilder(data);
      const result = builder.build();

      expect(result.parts).toHaveLength(1);
      expect(result.batchFile.fileSize).toBe(1);
      expect(result.batchFile.fileParts[0].fileSize).toBe(1);
    });

    it('concatenated parts equal original buffer', () => {
      const data = Buffer.from('This is test data for splitting and concatenation verification');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      const concatenated = Buffer.concat(result.parts);
      expect(concatenated).toEqual(data);
    });

    it('total file hash matches hash of concatenated parts', () => {
      const data = Buffer.from('content to verify hash consistency');
      const builder = new BatchFileBuilder(data);
      const result = builder.build(10);

      const concatenated = Buffer.concat(result.parts);
      const concatenatedHash = sha256Base64(concatenated);
      expect(result.batchFile.fileHash).toBe(concatenatedHash);
    });
  });
});

describe('KsefBatchService', () => {
  describe('prepare', () => {
    it('builds a TarGz archive, encrypted parts, and manifest keyed by local id', async () => {
      const material = createTestMaterial();
      const service = createBatchService();

      const prepared = await service.prepare({
        formCode,
        encryptionMaterial: material,
        partSizeBytes: 120,
        invoices: [
          { localId: 'invoice-1', fileName: 'invoice-1.xml', xml: '<Faktura>1</Faktura>' },
          { localId: 'invoice-2', fileName: 'invoice-2.xml', xml: '<Faktura>2</Faktura>' }
        ]
      });

      expect(prepared.compressionType).toBe('TarGz');
      expect(prepared.batchFile.compressionType).toBe('TarGz');
      expect(prepared.manifest).toEqual([
        {
          localId: 'invoice-1',
          fileName: 'invoice-1.xml',
          invoiceHash: sha256Base64(Buffer.from('<Faktura>1</Faktura>')),
          invoiceSize: Buffer.byteLength('<Faktura>1</Faktura>')
        },
        {
          localId: 'invoice-2',
          fileName: 'invoice-2.xml',
          invoiceHash: sha256Base64(Buffer.from('<Faktura>2</Faktura>')),
          invoiceSize: Buffer.byteLength('<Faktura>2</Faktura>')
        }
      ]);
      expect(prepared.batchFile.fileParts).toHaveLength(prepared.encryptedParts.length);
      prepared.encryptedParts.forEach((part, index) => {
        expect(prepared.batchFile.fileParts[index]).toMatchObject({
          ordinalNumber: index + 1,
          fileSize: part.byteLength,
          fileHash: sha256Base64(part)
        });
      });

      const archive = Buffer.concat(prepared.encryptedParts.map((part) => decryptPart(part, material)));
      expect(prepared.batchFile.fileHash).toBe(sha256Base64(archive));
      const tar = gunzipSync(archive);
      expect(tar.includes(Buffer.from('invoice-1.xml'))).toBe(true);
      expect(tar.includes(Buffer.from('<Faktura>1</Faktura>'))).toBe(true);
      expect(tar.includes(Buffer.from('invoice-2.xml'))).toBe(true);
      expect(tar.includes(Buffer.from('<Faktura>2</Faktura>'))).toBe(true);
    });

    it('rejects duplicate invoice hashes because results could not be correlated safely', async () => {
      const service = createBatchService();

      await expect(service.prepare({
        formCode,
        encryptionMaterial: createTestMaterial(),
        invoices: [
          { localId: 'invoice-1', fileName: 'invoice-1.xml', xml: '<Faktura>same</Faktura>' },
          { localId: 'invoice-2', fileName: 'invoice-2.xml', xml: '<Faktura>same</Faktura>' }
        ]
      })).rejects.toThrow(/duplicate invoiceHash/);
    });

    it('rejects batches above the buffered uncompressed archive size limit', async () => {
      const service = createBatchService();

      await expect(service.prepare({
        formCode,
        encryptionMaterial: createTestMaterial(),
        maxUncompressedArchiveSizeBytes: 2047,
        invoices: [
          { localId: 'invoice-1', fileName: 'invoice-1.xml', xml: '<Faktura>1</Faktura>' }
        ]
      })).rejects.toThrow(/uncompressed tar size 2048 exceeds buffered prepare limit of 2047 bytes/);
    });
  });

  describe('submit', () => {
    it('opens a batch session with prepared metadata, uploads parts by ordinal number, and closes the session', async () => {
      const material = createTestMaterial();
      const sessions = {
        openBatchSession: vi.fn(),
        closeBatchSession: vi.fn().mockResolvedValue(undefined)
      };
      const uploader = {
        uploadPart: vi.fn().mockResolvedValue(undefined)
      };
      const service = createBatchService(sessions, uploader);
      const prepared: PreparedBatch = await service.prepare({
        formCode,
        encryptionMaterial: material,
        partSizeBytes: 80,
        invoices: [{ localId: 'invoice-1', fileName: 'invoice-1.xml', xml: '<Faktura>1</Faktura>' }]
      });
      sessions.openBatchSession.mockResolvedValue({
        referenceNumber: 'batch-ref',
        partUploadRequests: prepared.encryptedParts
          .map((_, index) => ({
            ordinalNumber: index + 1,
            method: 'PUT' as const,
            url: `https://upload.test/${index + 1}`,
            headers: {}
          }))
          .reverse(),
        encryptionMaterial: material
      });

      const submitted = await service.submit('token', prepared, { uploadConcurrency: 2 });

      expect(submitted.referenceNumber).toBe('batch-ref');
      expect(sessions.openBatchSession).toHaveBeenCalledWith('token', prepared.batchFile, formCode, {
        encryptionMaterial: material
      });
      expect(uploader.uploadPart).toHaveBeenCalledTimes(prepared.encryptedParts.length);
      expect(uploader.uploadPart).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ ordinalNumber: 1 }),
        prepared.encryptedParts[0]
      );
      if (prepared.encryptedParts.length > 1) {
        expect(uploader.uploadPart).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ ordinalNumber: 2 }),
          prepared.encryptedParts[1]
        );
      }
      expect(sessions.closeBatchSession).toHaveBeenCalledWith('token', 'batch-ref');
    });
  });

  describe('waitForCompletion', () => {
    it('polls until session status is terminal', async () => {
      const sessions = {
        getSessionStatus: vi.fn()
          .mockResolvedValueOnce({ status: { code: 150, description: 'Processing' } })
          .mockResolvedValueOnce({ status: { code: 200, description: 'Succeeded' } })
      };
      const service = createBatchService(sessions);

      const status = await service.waitForCompletion('token', 'batch-ref', {
        initialDelayMs: 0,
        maxDelayMs: 0,
        maxAttempts: 2
      });

      expect(status.status.code).toBe(200);
      expect(sessions.getSessionStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('list and correlation helpers', () => {
    it('auto-paginates invoice lists and correlates rows by invoiceHash', async () => {
      const invoiceHash = sha256Base64(Buffer.from('<Faktura>1</Faktura>'));
      const sessions = {
        listSessionInvoices: vi.fn()
          .mockResolvedValueOnce({
            continuationToken: 'next',
            invoices: []
          })
          .mockResolvedValueOnce({
            continuationToken: null,
            invoices: [createSessionInvoice({ invoiceHash, referenceNumber: 'inv-ref' })]
          }),
        listFailedSessionInvoices: vi.fn().mockResolvedValue({
          continuationToken: null,
          invoices: [createSessionInvoice({ invoiceHash: 'other-hash', referenceNumber: 'failed-ref' })]
        })
      };
      const service = createBatchService(sessions);
      const manifest = [{
        localId: 'invoice-1',
        fileName: 'invoice-1.xml',
        invoiceHash,
        invoiceSize: Buffer.byteLength('<Faktura>1</Faktura>')
      }];

      const result = await service.getMappedResults('token', 'batch-ref', manifest, { pageSize: 10 });

      expect(sessions.listSessionInvoices).toHaveBeenNthCalledWith(1, 'token', 'batch-ref', {
        pageSize: 10
      });
      expect(sessions.listSessionInvoices).toHaveBeenNthCalledWith(2, 'token', 'batch-ref', {
        continuationToken: 'next',
        pageSize: 10
      });
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].localId).toBe('invoice-1');
      expect(result.unmatchedSessionInvoices).toHaveLength(1);
      expect(result.missingManifestItems).toHaveLength(0);
    });
  });
});

function createSessionInvoice(overrides: Partial<SessionInvoiceStatus>): SessionInvoiceStatus {
  return {
    ordinalNumber: 1,
    referenceNumber: 'invoice-ref',
    invoiceHash: 'hash',
    invoicingDate: '2026-01-01',
    status: { code: 200, description: 'Accepted' },
    ...overrides
  };
}
