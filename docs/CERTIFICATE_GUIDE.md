# Certificates & Authentication – API 2.0

This guide explains how to authenticate against KSeF API 2.0 using tokens and qualified certificates. It mirrors the flows described in:

- [`uwierzytelnianie.md`](https://github.com/CIRFMF/ksef-docs/blob/main/uwierzytelnianie.md)
- [`tokeny-ksef.md`](https://github.com/CIRFMF/ksef-docs/blob/main/tokeny-ksef.md)
- [`auth/sesje.md`](https://github.com/CIRFMF/ksef-docs/blob/main/auth/sesje.md)
- [`przeglad-kluczowych-zmian-ksef-api-2-0.md`](https://github.com/CIRFMF/ksef-docs/blob/main/przeglad-kluczowych-zmian-ksef-api-2-0.md)

`KsefApiV2Client` exposes the building blocks through `client.authentication`, `client.tokens`, and the exported helpers in `KsefApiV2`.

## 1. Token-based authentication

1. **Generate a token** – using the Portal or `/api/v2/tokens` (permissions required: `CredentialsManage`).
2. **Initiate authentication** – encrypt `token|timestamp` with RSA-OAEP using the public key published under `/security/public-key-certificates` (key usage: `KsefTokenEncryption`). This is handled by `AuthenticationV2Service.initiateTokenAuthentication`.
3. **Poll status** – `/auth/{referenceNumber}` returns the `authenticationToken` used for redemption.
4. **Redeem tokens** – `/auth/token/redeem` exchanges the `authenticationToken` for `accessToken` and `refreshToken` (JWTs). Refresh using `/auth/token/refresh` when the access token approaches `validUntil`.

```ts
import { KsefApiV2Client, ContextIdentifierType } from '@ksef/client';

const client = new KsefApiV2Client({ environment: 'prod' });
const context = { type: ContextIdentifierType.NIP, value: '1234567890' };

const init = await client.authentication.initiateTokenAuthentication(context, tokenFromPortal);
let status = await client.authentication.getAuthenticationStatus(init.referenceNumber, init.authenticationToken.token);
while (status.status.code === 100) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  status = await client.authentication.getAuthenticationStatus(init.referenceNumber, init.authenticationToken.token);
}
const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);
```

Use the returned `accessToken.token` as the `Authorization: Bearer` header for every protected call (`sessions`, `permissions`, `tokens`, etc.). Keep the `refreshToken` safe; if it is compromised, revoke the token using `/api/v2/tokens/{referenceNumber}`.

## 2. XAdES / qualified certificate flow

This path is mandatory when the context does not allow token-based login or when the organisation prefers certificate-first control.

1. **Load certificate/key** – supply a `.p12` bundle (preferred) or the PEM pair via `CertificateCredentials`.
2. **Challenge** – `client.authentication.requestChallenge()` obtains the nonce.
3. **Build & sign XML** – use `buildSignedAuthTokenRequest` internally by calling `client.authentication.initiateXadesAuthenticationWithCertificate(credentials, contextIdentifier)`.
4. **Send `/auth/xades-signature`** – optionally set `verifyCertificateChain=true` to enforce full CRL validation (TE defaults to true, production to false).
5. **Poll + redeem** – same as token-based flow.

```ts
const init = await client.authentication.initiateXadesAuthenticationWithCertificate(
  {
    certificate: fs.readFileSync('company-cert.p12'),
    password: process.env.KSEF_CERT_PASSWORD
  },
  { type: ContextIdentifierType.NIP, value: '9876543210' }
);
const tokens = await client.authentication.redeemTokens(init.authenticationToken.token);
```

### Subject identifier type

`initiateXadesAuthenticationWithCertificate` accepts `subjectIdentifierType` (default: `certificateSubject`). Override it for flows such as enforcement authorities where the identifier should be derived from PESEL or fingerprint per RC5.7 guidelines.

## 3. Session hygiene & revocation

- `AuthSessionService` (`KsefApiV2.AuthSessionService`) lists active sessions via `/auth/sessions` (lifecycle described in `auth/sesje.md`).
- Call `revokeCurrentSession` before rotating credentials or when the runtime is shutting down.
- Revoke specific session references when suspicious activity is detected (IP mismatch, unexpected access).

## 4. Certificate storage recommendations

| Item | Recommendation |
| --- | --- |
| **Format** | Prefer `.p12` with password protection. Convert `.pfx` to `.p12` if needed. |
| **Storage** | Keep certificates in dedicated secrets stores (AWS Secrets Manager, Azure Key Vault). Pass them to the SDK as `Buffer`/base64 strings. |
| **Rotation** | Track `validUntil` from `/certificates` portal. Schedule rotation before expiry; keep previous certificate until all sessions close. |
| **Offline certificate** | RC4 introduced separate offline certificates. Store them next to interactive ones and label them clearly—offline flows will be added to the SDK once MF publishes RC6 payloads. |

## 5. Troubleshooting

| Symptom | Cause | Resolution |
| --- | --- | --- |
| `401` on `/auth/token/redeem` | `authenticationToken` expired (15 minutes) | Re-run the challenge + init flow. |
| `422` on `/auth/ksef-token` | Token encrypted with stale timestamp | Ensure local clock sync (NTP) and always use the timestamp returned by `/auth/challenge`. |
| `550/21180` on session open | Using wrong certificate (offline vs interactive) | Double-check MF portal assignments; interactive sessions require the standard certificate. |
| `auth/sessions` shows unknown IP | Token leakage | Revoke the affected token + sessions, regenerate tokens with stronger description and storage policies. |

## 6. References in the repository

- `src/api2/services/authentication.ts` – source of truth for both auth paths.
- `src/api2/auth/xades-request.ts` – signed XML template matching `uwierzytelnianie.md`.
- `docs/API2_DEMO.md` – runnable walkthrough.
- `docs/API2_IMPLEMENTATION_NOTES.md` – reasoning behind encryption choices and certificate handling.
