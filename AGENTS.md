# Instructions for the agent

Read this file at the start of every session. Keep it short and correct; update it when the project changes.

## Project
<!-- One or two sentences: what the app does and for whom. Link SPEC.md. -->
See `SPEC.md` for goals, non-goals and acceptance criteria.
Club Calendar helps student-club members browse events and organisers manage limited places. Exercise 4 adds PostgreSQL, health checks and Docker deployment preparation to registration/cancellation, organiser editing/deletion, Google sign-in, poster assistance and shared-service MCP tools.

## Commands
<!-- How to install, run, test. Keep these exact and working. -->
- Install dependencies: `npm ci` (Node >=22.13).
- Apply PostgreSQL migrations explicitly: `npm run setup` (loads a private local .env if present; requires DATABASE_URL). Server startup never migrates or seeds.
- Run: `npm start` (loads .env if present, reads PORT; default http://localhost:3000; requires DATABASE_URL and HTTPS PUBLIC_BASE_URL in production).
- Test: `npm test` (SQLite regression fixtures; PostgreSQL integration also runs when TEST_DATABASE_URL is supplied).
- Coverage: `npm run coverage` (unchanged 100% service lines/functions/branches and 80% overall line gates; CI supplies disposable TEST_DATABASE_URL).
- MCP server: `npm run --silent mcp` (inherits DATABASE_URL and MCP_TOKEN; no implicit .env loading).
- Development seed: `npm run seed`; rotate demo password: `npm run seed -- --rotate-demo-password` (explicit, non-production only).
- Database inspection: `npm run db -- list`; isolated historical SQLite persistence proof: `npm run verify:slice`.
- Container: `docker build -t club-calendar .`; run with privately supplied env: `docker run --rm -p 3000:3000 --env-file .env club-calendar` (production requires HTTPS PUBLIC_BASE_URL).

## Conventions
<!-- Folder layout, naming, where business rules live, how errors are returned to the client. -->
- CommonJS on Node >=22.13; pg is the PostgreSQL driver. src/routes/ handles HTTP, src/services/ holds rules, src/data/ owns every SQL statement. Browser files live in src/web/.
- Apply PostgreSQL migrations from migrations/postgres/ explicitly with npm run setup; retain historical SQLite files in migrations/ for regression fixtures; never edit an applied migration. Seeds run only on explicit request and never recreate a removed event on server restart.
- Services raise AppError with a stable code; routes map it to a status and readable message. Never expose database rows containing hashes or sessions to the browser.

## Layers
<!-- Fill in the file or folder for each layer. -->
Requests arrive two ways and both end in the same place:

- HTTP route handler → service → data access → database
- MCP tool → **the same service** → data access → database

A route handler reads the request and turns a result into a status code. A service holds the
rules and knows nothing about HTTP or about MCP. Only the data layer writes SQL. An MCP tool
that talks to the database directly is a second, unguarded way into your data: never add one.
src/routes/app.js and mcp-server/project-tools.js call src/services/ implementations, which use src/data/repository.js, which selects the PostgreSQL adapter for the app and SQLite for isolated regression fixtures. MCP_TOKEN is an ordinary application session.

## The model feature
<!-- Provider, env var, and the call site. -->
- The provider is named in exactly one file: src/model/poster-client.js; src/services/poster.js validates suggestions and provides manual fallback.
- The key comes from an environment variable and is never committed or logged.
- Every call has a timeout and a deterministic fallback, so the app still works when the provider is down or rate-limited.
- Model suggestions are validated for field types, lengths, capacity range and date validity before display; saving rechecks event rules and club ownership.
- Tests never call the provider: they pass in a fake client.

## The MCP server
<!-- Where it lives and how it authenticates. -->
- Lives in `mcp-server/`, grew out of Exercise 1.
- Every project-data tool calls a shared service function; none touches the data layer or database directly. The two lecture tools read lectures.json separately.
- It carries a user, and enforces exactly the same authorization rules as the HTTP API.
- Adding a tool means adding a row to the table in `SPEC.md` too.

## Tests and coverage
- Every acceptance criterion in `SPEC.md` has an id like `AC-3`, and a test whose title contains that id.
- The coverage gate runs in CI: 100% of the service layer, 80% overall.
- A test is evidence. Changing a test so the code passes destroys the evidence.

## Always ask before
- deleting files or folders
- editing a migration that has already run
- installing or removing dependencies
- pushing, tagging or changing CI
- anything that touches secrets or `.env`
- changing an authentication or authorization rule
- adding, renaming or removing an MCP tool
- changing a coverage threshold
- sending user data to a third-party model

## Never
- commit secrets, passwords, API keys or an OAuth client secret
- weaken or delete a test to make it pass
- lower a coverage threshold or switch off a CI job to make the build green
- add an MCP tool that reaches past the service layer
- log a prompt that contains somebody's personal data
