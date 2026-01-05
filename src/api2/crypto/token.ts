import { constants, publicEncrypt } from 'node:crypto';

/**
 * Encrypts the token challenge payload using RSA-OAEP with SHA-256 as required by
 * https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md#22-uwierzytelnianie-tokenem-ksef
 */
export function encryptTokenPayload(
  token: string,
  challengeTimestamp: string | number,
  publicKeyPem: string
): string {
  const unixMilliseconds = toUnixMilliseconds(challengeTimestamp);
  const payload = `${token}|${unixMilliseconds}`;
  const buffer = Buffer.from(payload, 'utf8');

  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    buffer
  );

  return encrypted.toString('base64');
}

function toUnixMilliseconds(timestamp: string | number): number {
  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid challenge timestamp received from KSeF: ${timestamp}`);
    }
    return timestamp;
  }

  const trimmed = timestamp.trim();
  if (/^\d+$/.test(trimmed)) {
    const millis = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(millis)) {
      throw new Error(`Invalid challenge timestamp received from KSeF: ${timestamp}`);
    }
    return millis;
  }

  const millis = Date.parse(trimmed);
  if (Number.isNaN(millis)) {
    throw new Error(`Invalid challenge timestamp received from KSeF: ${timestamp}`);
  }
  return millis;
}
