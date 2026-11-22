# Agent log

One entry per agent session, newest at the bottom. Be honest: what went wrong is the useful part.

<!-- Copy this block for each session:

## YYYY-MM-DD · <short title>
- Goal:
- Delegated:
- Checkpoints:
- Went wrong:
- Changed by hand:

-->

## 2026-11-19 · Exercise 1
- Goal: Complete exercise 1
- Delegated: Tool calling and code explaination
- Checkpoints:
- Went wrong: When I first asked gemini questions to test whether it calls the mcp's tools it would start thinking for a long time so I changed the model to a flash one and asked again which fixed the problem
- Changed by hand: Nothing

## 2026-11-20 · Exercise 2
- Goal: Writting the project specs and having the agent accuratly build out the first slice
- Delegated: Delegated the building of the first slice to gemini
- Checkpoints:
- Went wrong:
- Changed by hand: Other than the SPEC.md file nothing was written by hand

## 2026-11-20 · Exercise 3
- Goal: implement event registration/cancellation through every layer, plus the existing model, organiser and provider criteria required by the supplied all-criteria self-check.
- Autonomy: I authorized the agent to work within one plan step at a time, with tests and diff-review checkpoints before local commits; no remote push without my approval.
- Checkpoints: approve this plan before implementation; prove a service rule test fails first; apply new migrations to an empty database; test service/API failures and ownership; inspect the UI; demonstrate that disabling a rule breaks a test; run all self-checks and coverage.
- Delegated: I delegated implementation and automated verification to the agent, excluding real model requests, secret configuration, dependencies and CI changes.

## 2026-11-21 · Exercise 3 Extended
- Goal: I requested owner-only event deletion, clearing a selected poster without reloading, and an explanation of external feature configuration.
- Plan: add AC-19/20; failure-first deletion service test; repository delete using existing registration cascade; DELETE endpoint; explicit confirmation UI; clear poster selection/consent and ignore stale suggestions; test and document.
- Authorization: I approved adding event deletion for the owning organiser and clearing the selected poster. The agent reused the existing owner-only management rules; no MCP tools or migrations changed.
- Checkpoints: new service test failed before implementation; then 41 tests passed, service coverage stayed 100%, overall line coverage 94.87%, Exercise 3 self-check 18/18. git diff --check passed.
- Changed in review: no dependencies, secrets, environment files or CI changes. No live provider calls or browser visual verification; UI behavior has browser-script tests.
- What the agent did that I did not ask for: clearing a poster also invalidates outstanding suggestions so a late reply cannot restore removed content. Existing event fields remain unchanged.

## 2026-11-21 · Exercise 4 preparation
- Goal: I approved starting deployment readiness work after reviewing the course requirements.
- Delegated: configuration inventory, PostgreSQL migration planning, health/error handling, container packaging and automated checks.
- Plan: retain SQLite migration history; add a PostgreSQL data adapter and separate numbered PostgreSQL migrations; make shared services, HTTP and MCP await database operations; test with disposable PostgreSQL in CI; add startup checks and explicit migration commands; build Docker; then review before deployment.
- Checkpoints: I approved pg and disposable PostgreSQL CI tests before those changes; no .env reads, live provider calls, remote migrations, deployments or pushes. I will supply real settings privately and perform the manual report checks.
- Went wrong: Docker CLI is installed but its Linux daemon is not currently available; container build/run verification needs Docker Desktop running or Codespaces.

- Results so far: original SQLite migrations and data retained; runtime HTTP/MCP moved to PostgreSQL with asynchronous shared services. Existing tests retain their assertions, using awaited rejection checks where the API became asynchronous. PostgreSQL integration proves competing registrations, ownership, migration idempotency, provider linking with fake clients, event deletion, explicit seed/password rotation and persistence across reconnects.
- Container evidence: Node 22 Alpine image builds; runtime uid is 1000; .env, test.jpg and opencode.json are absent. Login page and /health return 200. Stopping the disposable PostgreSQL container changes health to 503 with only status error/db down.
- Coverage proof: temporarily skipping the logout test did not drop coverage because other tests also exercised those paths. Skipping the dedicated poster-refusal test produced exit 1 with service lines 98.57% and branches 98.60%. Original test bytes were restored. No deliberately failing commit has been pushed; remote red/green proof remains pending.
- Secrets search: known credential-pattern scans of tracked files and all Git patches found no Google API keys, OAuth client secrets, GitHub tokens or private keys. This is limited evidence, not a guarantee; my manual history review remains required. The agent did not print or inspect secret values. A later local Exercise 4 checker invocation internally opened .env because of its presence-based implementation; its output contained no values. The checker was then rerun in an isolated directory without .env.
- Deployment claims: no successful live deployment is claimed. I still need to configure Neon and Render privately, write the screen-rendering table and READINESS.md from observations, complete the live UI checklist and approve pushes.

- Final local checkpoint: 55 tests pass including two real PostgreSQL integration tests; unchanged service coverage gates pass at 100%, overall lines 96.56% on Node 22 Alpine. The Docker image builds and required-config startup refusal was observed. Exercise 2/3 checks pass; isolated Exercise 4 check is 10/14, pending live URL, READINESS.md and UI evidence/checklist. No UI boxes were ticked or manual observations invented.

### 2026-11-21 · Local evidence and final checks
- Authorization: I requested completion of the remaining local work, explicitly excluding deployment. Chrome file-upload permission was enabled for selecting the existing poster fixture.
- Evidence collected: actual events loading/empty/error/content states, poster progress and missing-key fallback, and login/events/detail/editor captures at 380/768/1280 px. Temporary disposable-database locks rolled back and changed event dates were restored. No model request was sent to Google.
- Review correction: the All events header link measured about 22 px tall. A focused shared-CSS change raised it to 44 px; final DOM measurements found no undersized visible targets at the three widths. Input labels and horizontal overflow were audited.
- Verification: 55 tests passed with disposable PostgreSQL, service lines/functions/branches 100%, overall lines 96.56%; Docker image rebuilt successfully. Exercise 2 32/32, Exercise 3 18/18, MCP conformance 12/12; diff whitespace check passed. The first host Exercise 3 run lacked sandbox socket permission; the permitted rerun passed. Running coverage inside the production image initially failed because test files are intentionally excluded; mounting source read-only supplied the tests and both gates passed.
- Limited credential-pattern scan: 113 candidate files and Git patch history, no known API-key/OAuth-secret/GitHub-token/private-key matches; .env is untracked. This does not replace my independent manual history inspection.
- Remaining: isolated Exercise 4 check 11/14. READINESS.md and liveUrl are absent; three UI items remain unticked (layout shifts, all-screen 100 ms feedback measurement and create-event document title). No deployment, push or commit was made in this checkpoint.
- Approval-review block: automatic review rejected writing the proposed SPEC rendering table and READINESS draft because the course assigns personal observations/gap ranking to me. Neither proposed edit was applied; explicit approval acknowledging that requirement is pending.
- Deployment claims: no successful deployment was claimed or tested; none was found false. Local evidence is not public HTTPS, Neon redeploy-persistence or live Google/model verification.
- Documentation follow-up: after the approval-review block was explained, I explicitly requested that the agent write the readiness draft and rendering table. The resulting documents distinguish collected local evidence from unperformed live checks and retain the need for personal review. No deployment or push was authorized by this follow-up.

## What the agent did that I did not ask for
- Added focused tests for sign-in, data persistence, HTTP and browser-script states so the slice has checkable evidence.
- Used optional visual-inspection tooling during verification; removed it and the separate plan/checks documents after review because Exercise 2 does not require those files.
- Added explicit local demo-password rotation so a lost generated password does not require deleting the database or reseeding events.
- Removed an unnecessary re-login session-rotation branch from the HTTP handler; ownership/session rules stay in services.
- Used a compact header instead of the design sheet's sidebar because this slice has one destination.
- Kept final coverage thresholds unchanged and enforced them from the custom coverage command so the existing CI custom-script path cannot silently skip its gates.

### Plan
1. Migration: add migrations/002_feature_integrity.sql with registration-capacity protection, the relations needed for verified provider linking and short-lived OAuth state. Do not edit 001_initial.sql. Test an empty database and preserve existing demo data. Commit the working migration step.
2. Registration service: extend src/data/repository.js with transactional registration/cancellation operations; add src/services/registrations.js. Write failure tests first for full and duplicate events, then enforce capacity and owner-only cancellation. New slice criteria AC-16: successful registration returns 201 and reserves one place; AC-17: past events reject registration with 409; AC-18: signed-out creation/cancellation returns 401, another owner's cancellation returns 403 and changes no row. Existing AC-2/3/4 remain unchanged.
3. HTTP and organiser feature: POST /api/registrations (201/401/404/409/422), DELETE /api/registrations/:id (204/401/403/404), and GET /api/registrations (200/401). Add organiser create/edit/detail operations needed for existing AC-5, validating club ownership and capacity in services. All routes reuse services and return readable errors. Add real HTTP tests and commit working service/API/authorization steps separately.
4. Provider sign-in: add a Google adapter outside HTTP handlers, short-lived single-use state and PKCE, and service-level verified-email account linking for AC-6. Provider login issues the existing ordinary session. Test with an injected fake provider; leave credentials untouched and do not perform real sign-in during development.
5. Poster feature: add src/model/poster-client.js and a service for AC-7/8. Accept only a deliberately selected supported poster image; five-second timeout, validated suggestions, invalid dates left blank and manual-entry fallback. Nothing is saved without explicit organiser confirmation. Test valid, malformed and unavailable responses with fake clients; make no real model calls.
6. MCP: keep the two lecture tools and add the four tools already listed in SPEC.md: upcoming_events, my_registrations, register and cancel_registration. Each uses the ordinary MCP_TOKEN session and exactly the same services as HTTP, with no SQL in MCP. Test the handshake, tool permissions and full-event refusal (AC-9).
7. UI: extend the existing events screen and add event detail/organiser editing views from SPEC.md. Add working registration/cancellation, organiser forms and poster suggestions with loading, empty, error and success states. Google sign-in appears on the existing login screen. Keep the current design tokens and stack; no redesign or optional inspection tooling.
8. Verification and documentation: map every AC to a real test, prove the rule tests detect a disabled rule and restore it, retain 100% service and 80% overall gates, and run checks/ex2.mjs, checks/ex3.mjs and MCP conformance. Update the architecture section in SPEC.md with actual layers for review, and record plan corrections, actual usage availability and any work outside the plan. At least five separate working feature commits; no squashing into Exercise 2.
- Changed in review: I approved the plan, AC-16 through AC-18, automated checkpoints, ownership/provider authorization and the four specified MCP additions in chat. Keep the existing stack and coverage gates; no extra inspection tooling or real provider/model requests.

### Exercise 3 verification and corrections
- Checkpoints completed: numbered migration on an empty database; failure-first registration service tests; real HTTP registration and organiser tests; provider/model tests with injected clients; shared-service MCP tools; browser-script workflow tests. Separate migration, service, HTTP, authentication, model, MCP and UI commits preserve the steps.
- Rule proof: temporarily disabled the full-event service guard. AC-2 failed because the database integrity error replaced the required readable service refusal. Restored the original file bytes and reran the registration tests successfully.
- Went wrong: the supplied check could not launch npm on Windows (spawnSync npm ENOENT). The minimal launcher compatibility change in checks/lib.mjs was explicitly approved; assertions and thresholds are unchanged. The available browser timed out connecting to the isolated local preview; no visual verification is claimed.
- Changed in review: real Google and model adapters remain separate from the injected test clients. No real provider requests or credential configuration were performed. The architecture note records the remaining browser fetch inconsistency for review.
- Remaining checks by hand: exercise the new screens on localhost and review the architecture explanation; configure and verify live Google/model integrations separately. Remote push and CI require approval.
- Usage: session token and billing counters are unavailable; no estimates were substituted for measured usage.

### What the agent did that I did not ask for - Exercise 3
- The Windows npm launcher correction was outside the original plan; I approved it before the agent made the change. No optional report or inspection files were added.
- Final automated results: 37 tests passed; service lines/functions/branches 100%; overall lines 94.25%; Exercise 2 self-check 32/32, Exercise 3 self-check 18/18 and MCP conformance 12/12. git diff --check passed.
