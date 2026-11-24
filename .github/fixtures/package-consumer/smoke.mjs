import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '@ksef/client';
import * as esmCrypto from '@ksef/client/crypto';
import * as esmValidation from '@ksef/client/validation';

const require = createRequire(import.meta.url);
for (const [sdk, crypto, validation] of [
  [esm, esmCrypto, esmValidation],
  [require('@ksef/client'), require('@ksef/client/crypto'), require('@ksef/client/validation')]
]) {
  assert.equal(sdk.KsefApiV2.KsefApiV2Client, sdk.KsefApiV2Client);
  assert.equal(typeof sdk.KsefApiV2.AuthenticationV2Service.prototype.getAuthenticationStatusRev2, 'function');
  assert.equal(typeof sdk.KsefApiV2.AuthSessionService.prototype.listSessionsRev2, 'function');
  for (const method of ['generateTokenRev2', 'queryTokensRev2', 'getTokenRev2', 'approveToken']) {
    assert.equal(typeof sdk.KsefApiV2.TokenService.prototype[method], 'function');
  }
  assert.equal(sdk.KsefApiV2.calculateOfflineDeadline, sdk.calculateOfflineDeadline);
  assert.equal(sdk.calculateOfflineDeadline('awaria_calkowita'), null);
  assert.equal(crypto.generateSHA256Hash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(validation.validateNIP('invalid'), false);
}
