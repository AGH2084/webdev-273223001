# Readiness report: Club Calendar

Evidence recorded on 2026-11-21. This draft records local browser automation, automated checks and the manual local review reported complete in chat. Deployment was excluded. The observations and proposed gap ranking still need personal review before submission.

## 1. Live URL and how to verify it

Not deployed. `course.json` deliberately has an empty `liveUrl`. The disposable local preview is `http://localhost:3104`; this is not a public HTTPS address.

After deployment, check `/health` returns 200 with `{"status":"ok","db":"ok"}`, complete sign-in and registration, and confirm a record survives redeployment. No live result, rollback time or cold-start time is claimed.

How I checked: local browser captures and container health checks. No Render deployment was performed.

## 2. Environment variables

| Name | Purpose | Value source | Secret |
| --- | --- | --- | --- |
| DATABASE_URL | Required PostgreSQL connection | Neon Connect dialog; disposable PostgreSQL locally | Yes |
| PUBLIC_BASE_URL | App origin and OAuth callback; HTTPS required in production | Actual hosting address | No |
| PORT | Listener port; defaults to 3000 | Hosting platform or local configuration | No |
| NODE_ENV | Production startup and seed restrictions | Runtime configuration | No |
| GOOGLE_CLIENT_ID | Optional Google OAuth client | Google Cloud Console | No |
| GOOGLE_CLIENT_SECRET | Optional Google OAuth credential | Google Cloud Console | Yes |
| GEMINI_API_KEY | Optional poster API credential | Google AI Studio | Yes |
| MODEL_NAME | Poster model; defaults to gemini-3.5-flash-lite | Selected model ID | No |
| MCP_TOKEN | Ordinary application session for local stdio tools | Private authenticated session from the same database | Yes |
| TEST_DATABASE_URL | Disposable integration database only | Local/CI PostgreSQL fixture | Yes, except publicly documented disposable fixtures |

There is no SESSION_SECRET: sessions are opaque random tokens stored as hashes. Startup neither migrates nor seeds; `npm run setup` applies migrations explicitly. Start/setup/seed/db commands load a private `.env` if present; the MCP command does not.

How I checked: compared `.env.example`, configuration and command entry points. Configuration tests reject missing DATABASE_URL, invalid ports/URLs and HTTP production origins. The private `.env` was not read for this report.

## 3. What happens when things fail

- Database down: `/health` returns 503 with status error/db down, without connection details. The events screen offers a readable notice and Retry. Pool/query waits are bounded at five seconds.
- Unknown page: 404 and a readable message. Malformed authenticated JSON: 400 and a readable message. Unexpected errors: generic 500 response, with server-side stack frames logged while omitting the potentially sensitive first-line error message.
- Missing required configuration: startup stops with the configuration problem rather than starting partially configured.
- Bad deploy and rollback: not attempted. Before submission, verify the host's documented rollback procedure and measure a real rollback. Rolling back application code does not automatically reverse database migrations.

How I checked: AC-21/22/23 tests, the disposable PostgreSQL stop/start health check, and the real events timeout captured in [the error screenshot](docs/ui/events-error.jpg). No live failure drill is claimed.

## 4. Four states of one screen

| Upcoming-events state | Observed result | Evidence |
| --- | --- | --- |
| Loading | Loading club events…, disabled Refresh; existing rows retained during refresh | [Screenshot](docs/ui/events-loading.jpg) |
| Content | Future events, Sofia times and calculated free places | [Screenshot](docs/ui/events-success-1280.jpg) |
| Empty | Nothing is scheduled yet. Check back soon for your next club event. | [Screenshot](docs/ui/events-empty.jpg) |
| Error | Readable connection notice and Retry; stale rows removed | [Screenshot](docs/ui/events-error.jpg) |

How I checked: a temporary disposable-database lock delayed the events query. Temporary past fixture dates produced the empty state; every original date was restored. No application mocks or DOM substitutions were used. The wider checklist and its limitations are in [docs/UI.md](docs/UI.md).

## 5. Request waterfall

One cache-disabled, unthrottled Chrome capture recorded **8 requests, 56.1 kB transferred, DOMContentLoaded 553 ms, load 871 ms and finish 888 ms**. The document took 34 ms, local stylesheet 8 ms, events script 9 ms and events API 7 ms. The external Google Fonts stylesheet took 479 ms and its font 319 ms.

The HTML initiates stylesheet/script/logo requests. The font depends on the Google stylesheet; the events API request is initiated by events.js. DOMContentLoaded preceded completion of the API request, so the HTML shell was available before event data. This is one local sample, not a production benchmark.

How I checked: [Chrome Network screenshot](docs/ui/events-waterfall.png), All requests, Disable cache enabled, no throttling. The cache setting was restored afterwards.

## 6. Security basics checked

Passwords use salted scrypt and sessions store SHA-256 token digests. Cookie flags are HttpOnly (prevents script access), SameSite=Lax (limits cross-site sending), Path=/ and Secure for HTTPS origins (HTTPS transport only). Sessions expire after eight hours; logout revokes them. Same-origin checks protect writes. SQL is parameterised in the data layer; project MCP tools use the same services as HTTP.

Automated tests separately exercise signed-out requests and signed-in non-owners for event management and registration cancellation. AC-19 verifies a member/other organiser cannot delete an event and its rows remain unchanged. This is automated evidence, not a claim of a manual second-account deletion test during screenshot collection.

How I checked: 57 passing tests including disposable PostgreSQL integration; current service lines/functions/branches 100%, overall lines 96.56%. A limited credential-pattern scan covered 113 candidate files and Git patch history, finding no known Google API-key, OAuth-secret, GitHub-token or private-key patterns. `.env` is untracked. This does not replace an independent manual history search. Public HTTPS remains unverified.

## 7. Known gaps, ranked by risk

Proposed ranking for personal review:

1. **No deployed end-to-end evidence.** Public HTTPS, Neon persistence across redeploy, live Google callback, cold starts, rollback and Render CI gating are unverified. Next: deploy only after approval, check each behavior and record actual results. This blocks completion of Exercise 4.
2. **Exercise 4 remote red/green CI proof is pending.** A deliberate local coverage failure was observed and restored; no failing commit was pushed. Next: review and authorize the demonstration, then inspect Actions and the deployment gate.
3. **Known behavior/spec discrepancies.** my_registrations includes past registrations despite its upcoming-only description; failed registration can re-enable Register for a started event although the service refuses it; lecture descriptions/errors say 1–12 while data contains 1–10. Next: review and correct each contract with matching tests before defence.
4. **Local UI measurements have limited coverage.** Chrome recorded a maximum interaction-to-next-paint of 32 ms for the poster test and 24 ms for the other sampled actions. Initial calendar and create-editor samples had zero layout shift. Next: repeat these measurements on the deployed site and representative devices. See [the UI checklist](docs/UI.md).
5. **Independent review remains.** The diff, secret history, report observations and gap ranking need personal review before submission. Next: perform that review; automated evidence alone does not establish it happened.

How I checked: compared the recorded browser results, source behavior and local/remote checks actually performed against the course checklist. No unperformed check is marked complete.

## 8. Model feature

Only the deliberately selected PNG/JPEG poster, up to 1 MB, and extraction instructions are sent to Google's Gemini API after organiser consent. Account profiles, passwords, sessions and attendee lists are not sent. The image leaves the app for extraction and is not stored as an event attachment. Suggestions are validated, labelled and saved only after separate confirmation and normal event/ownership checks.

The default model is Gemini 3.5 Flash-Lite. [Published standard pricing](https://ai.google.dev/gemini-api/docs/pricing/), checked 2026-11-21: $0.30 per million input tokens and $2.50 per million output tokens, including thinking. An illustrative uncached call with 2,000 input and 500 output tokens would cost **$0.00185**. This is an estimate, not measured usage; actual image/output token counts vary. Free-tier billing is zero within its limits.

A missing key produces a readable not-configured/manual-entry notice. Timeout, denied access, 429/quota failure and invalid output also fall back without saving. The server timeout is 30 seconds and browser timeout 35 seconds.

How I checked: selected the existing test.jpg fixture through the real file picker. [Progress](docs/ui/poster-thinking.jpg) was captured while a temporary sessions-table lock delayed the local request. A separate request after automatic rollback produced the actual [missing-key fallback](docs/ui/poster-failure.jpg). No Google request was made. Injected-client tests cover suggestion and provider-failure branches; production behavior remains unverified.

## 9. MCP

Project tools are upcoming_events, my_registrations, register and cancel_registration. Each acts as the user identified by MCP_TOKEN, an ordinary session from the same database, expiring after eight hours and revoked by logout. Registration/cancellation reuse HTTP service rules for capacity, duplicates and ownership. Two lecture tools separately read public course data.

The server uses local stdio and is not deployed as a remote endpoint. Keeping it local avoids exposing a remote interface without remote transport authentication/OAuth. An agent does not inherit browser cookies: its process needs a private authenticated session. A defence client can run the server against the configured database with its own session. Never commit or share that token.

How I checked: MCP conformance 12/12 and shared-service/PostgreSQL integration tests. Earlier OpenCode testing registered, rejected a duplicate and cancelled, restoring the initial place count. No production MCP result is claimed.
