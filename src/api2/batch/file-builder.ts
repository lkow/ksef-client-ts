import type { BatchFileInfo, BatchFilePartInfo, CompressionType } from '../types/common.js';
import { sha256Base64 } from './crypto.js';
import type { BatchFileBuildResult } from './types.js';

export class BatchFileBuilder {
  constructor(private readonly buffer: Buffer) {}

  build(
    partSize = 5 * 1024 * 1024,
    options: { compressionType?: CompressionType | null } = {}
  ): BatchFileBuildResult {
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

    const batchFile: BatchFileInfo = {
      fileSize: this.buffer.byteLength,
      fileHash: sha256Base64(this.buffer),
      ...(options.compressionType ? { compressionType: options.compressionType } : {}),
      fileParts: partInfos
    };

    return {
      batchFile,
      parts
    };
  }
}
