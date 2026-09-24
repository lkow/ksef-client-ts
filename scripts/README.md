# Local XAdES analytical tools

These repository tools support manual signature diagnostics. They are not included in the published SDK package and do not replace a complete XAdES validator or prove that KSeF will accept a signature.

## Preparation

Run commands from the repository root with Node.js 20+ and the pnpm version declared in `package.json`. Install the repository dependencies if needed (`pnpm install --frozen-lockfile`). Before using `xades:auth` or `xades:check`, run `pnpm run build`: both import the generated `dist/index.js`.

Provide your own PEM certificate and matching private key. No credentials are distributed with these tools. Set environment variables in your shell; the scripts do not automatically load `.env` files.

```bash
export KSEF_CERT_PEM="$PWD/certs/diagnostic-cert.pem"
export KSEF_KEY_PEM="$PWD/certs/diagnostic-key.pem"
```

For an encrypted key, supply `KSEF_KEY_PASS` securely in the environment. Do not put passwords in committed files or shared shell history.

## Tools

| File / command | Purpose | Network access |
| --- | --- | --- |
| `xades-auth-flow.mjs` / `pnpm xades:auth` | Fetch a challenge, sign the authentication XML, submit it, and print the HTTP status and full response. Does not poll authentication status or redeem tokens. | Yes, authentication requests to the selected KSeF URL. |
| `xades-sign-check.mjs` / `pnpm xades:check` | Generate signed XML and check the signature and digests against raw XML strings. Exits with code 2 on a mismatch. | No. |
| `xades-debug-c14n.mjs` | Compare constructed XML fragments before and after exclusive canonicalization, including byte and namespace differences. | No. |
| `xades-debug-signedprops.mjs` | Inspect an existing signed XML file and compare raw and canonicalized `SignedProperties` digests. | No. |

The debug tools print diagnostic comparisons; a successful exit alone does not mean all digests match. The raw-string checks in `xades:check` are implementation-specific, not general XML signature validation.

### Local checks

```bash
pnpm xades:check
node scripts/xades-debug-c14n.mjs
SIGNED_XML=./xades-artifacts/auth-token-request-signed.xml node scripts/xades-debug-signedprops.mjs
```

The first two commands require `KSEF_CERT_PEM` and `KSEF_KEY_PEM`. The canonicalization debug script currently checks that the key path variable is set but only reads the certificate. The SignedProperties tool only needs an existing signed XML file; its default path is the one shown above.

For `xades:check`, optional `KSEF_CHALLENGE` defaults to `test-challenge`, `KSEF_NIP` defaults to the placeholder `1234567890`, and any non-empty `DEBUG` enables extra diagnostics. The canonicalization debug tool uses hardcoded diagnostic challenge/NIP values rather than these overrides.

### Authentication request (explicit network operation)

Use a certificate and context suitable for the selected environment. Replace the placeholder NIP before running:

```bash
KSEF_ENV=test KSEF_NIP=1234567890 KSEF_OUTPUT_DIR=./xades-artifacts pnpm xades:auth
```

Authentication variables:

| Variable | Behavior |
| --- | --- |
| `KSEF_ENV` | `test` (TE, default), `demo` (TR), or `prod`. Unrecognized values currently fall back to TEST. |
| `KSEF_BASE_URL` | Overrides the target URL; include `/v2`. Check it before running. |
| `KSEF_NIP` | Context value; defaults to placeholder `1234567890`. |
| `KSEF_CONTEXT_TYPE` | Defaults to `Nip`. |
| `KSEF_SUBJECT_IDENTIFIER_TYPE` | Defaults to `certificateSubject`. |
| `KSEF_VERIFY_CHAIN` | Explicit `true` or `false` value for the `verifyCertificateChain` query parameter. Current default is `false` for `KSEF_ENV=prod`, `true` otherwise. |
| `KSEF_OUTPUT_DIR` | If set, creates the directory and writes unsigned and signed authentication XML, overwriting the two corresponding files if they exist. Otherwise no XML files are saved. |

The chain-verification default depends on `KSEF_ENV`, even when `KSEF_BASE_URL` overrides the destination. Set it explicitly when overriding the URL. These are descriptions of the current script behavior, not recommendations for production settings. TE and TR credentials and server behavior are not interchangeable; a result in one environment does not establish acceptance in another.

## Sensitive output and local files

The authentication tool intentionally prints the full response, which may include an authentication token. Debug output can contain certificate identity data and XML fragments. Keep terminal recordings, logs, and XML files private; redact them before sharing in issues or pull requests.

All four scripts and this guide are intended to be versioned. Root-level `certs/`, `xades-artifacts/`, and `ksef-official/` are ignored by Git and stay local. Paths selected through environment variables can point elsewhere; those locations are not automatically protected by these ignore rules.
