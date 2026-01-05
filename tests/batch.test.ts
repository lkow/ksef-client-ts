import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { BatchFileBuilder, sha256Base64 } from '../src/api2/batch.js';

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

