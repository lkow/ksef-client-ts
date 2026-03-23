# Next Steps Tracker

Last updated: 2026-03-23

## Recently Completed

- [x] `461cb38` Add `AuthManager` with HTTP-level auto-refresh on `401`.
- [x] `7f98c0d` Improve permissions query typing (`PersonalPermission`).
- [x] `e66ad9d` Centralize API v2 route definitions (`src/api2/routes.ts`).

## Backlog

### P0

- [x] **P0-1: OpenAPI drift + coverage guardrail**
  - Add script to compare current `docs/reference/ksef-api-v2-openapi.json` with upstream and verify endpoint coverage.
  - Acceptance:
    - Script fails on spec drift.
    - Script fails when implemented routes/services diverge from spec operations.
    - CI runs the check on PRs.

- [x] **P0-2: Release workflow quality gates**
  - Update release pipeline to run `lint`, `test:unit`, and `build` before packaging/release.
  - Acceptance:
    - Release job fails fast on lint/test/build failure.
    - Artifact publication only happens after all checks pass.

### P1

- [ ] **P1-1: Batch upload hardening**
  - Add pre-signed URL validation + safer upload retries/backoff for `BatchSessionUploader`.
  - Acceptance:
    - Reject malformed/non-HTTPS/unexpected hosts.
    - Retry transient failures and surface clear terminal errors.

- [ ] **P1-2: High-level workflow module**
  - Add workflow helpers for common multi-step operations:
    - Auth flow (`challenge -> init -> poll -> redeem`).
    - Online session (`open -> send -> close -> poll`).
    - Export polling helper.
  - Acceptance:
    - New workflow API is tested and documented.
    - Existing low-level services remain unchanged.

- [ ] **P1-3: Error model refinement**
  - Introduce dedicated typed API errors for `401`, `403`, `429` with mapped details/reason codes.
  - Acceptance:
    - Callers can branch by error class instead of parsing message text.
    - Unit tests cover mapping from representative API responses.

### P2

- [ ] **P2-1: API2-only type surface cleanup**
  - Reduce overlap between `src/types/*` and `src/api2/types/*` where practical.
  - Acceptance:
    - Shared/public types used by API2 are clearly owned in one place.
    - No behavior change; tests unchanged.

- [ ] **P2-2: Docs and script hygiene**
  - Decide what to do with local assets (`certs/`, `ksef-official/`, `xades-artifacts/`, `scripts/`) and update `.gitignore`/docs accordingly.
  - Acceptance:
    - Clear policy: tracked vs local-only.
    - Running documented scripts does not depend on hidden local state.

## Fresh Chat Handoff

Use this in a new chat:

1. Ask to open `/Users/lukasz/IdeaProjects/KSEF/docs/NEXT_STEPS.md`.
2. Pick one item (for example `P0-1`).
3. Request implementation + tests + commit.
