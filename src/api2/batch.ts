import { createHash } from 'node:crypto';
import type { BatchFileInfo, BatchFilePartInfo } from './types/common.js';

export interface BatchFileBuildResult {
  batchFile: BatchFileInfo;
  parts: Buffer[];
}

export class BatchFileBuilder {
  constructor(private readonly buffer: Buffer) {}

  build(partSize = 5 * 1024 * 1024): BatchFileBuildResult {
    const parts: Buffer[] = [];
    const partInfos: BatchFilePartInfo[] = [];

    for (let offset = 0, ordinal = 1; offset < this.buffer.length; offset += partSize, ordinal++) {
      const part = this.buffer.subarray(offset, Math.min(offset + partSize, this.buffer.length));
      parts.push(part);
      partInfos.push({
        ordinalNumber: ordinal,
        fileSize: part.byteLength,
        fileHash: sha256Base64(part)
      });
    }

    return {
      batchFile: {
        fileSize: this.buffer.byteLength,
        fileHash: sha256Base64(this.buffer),
        fileParts: partInfos
      },
      parts
    };
  }
}

export function sha256Base64(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return hash.digest('base64');
}
