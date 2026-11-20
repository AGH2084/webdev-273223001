# Club Calendar

<!-- Exercise 2. Write the non-goals first. Every acceptance criterion must be checkable in under a minute.
     Keep these headings exactly as they are: the self-checks look for them by name.
     The full target is on the course site under Resources → The course project. -->

## Project option
<!-- One line: lab booking, study groups, club events, or the own project the lecturer approved. -->
Club events.

## Goals
- A member signs in, browses upcoming club events and reserves or cancels their own place.
- An organiser creates and edits their events, sets capacity and sees their attendee list.

## Non-goals
- No payments or paid tickets: every event is free.
- No email or push notifications: members check the website.
- No native mobile application: the web interface also works on phones.
- No public account-registration form in Slice 1: use explicitly seeded development accounts.

## Constraints
- Node.js 22.13 or newer, built-in HTTP/crypto/SQLite modules, plain HTML/CSS/JavaScript; no runtime dependencies for Slice 1.
- SQLite is the local Exercise 2 database. Move the data adapter and migrations to PostgreSQL before the persistent Neon deployment in Exercise 4.
- Numbered migrations, parameterised SQL only in src/data/, and business rules only in src/services/.
- Passwords are salted scrypt hashes. No credentials, personal prompts or raw session tokens in application logs or committed configuration. The explicit local seed command displays a newly generated fictional demo-account password once for the developer.
- Final coverage gates: 100% of service lines, functions and branches; at least 80% overall. Every AC has a named test by Exercise 3.

## The model feature
<!-- Which model, which modality, and what it does for a user.
     Name three things or the check fails: the input it receives, the output it produces,
     and what happens when the model is slow, rate-limited or wrong. -->
- Model: Gemini 2.5 Flash, vision, adapter src/model/poster-client.js, configurable through MODEL_NAME; poster extraction assists organisers. Live provider availability still needs verification with configured credentials.
- Input: only the poster image explicitly selected by the organiser; this image leaves the app for Google's hosted API. No member profiles, passwords, sessions or attendee lists are sent.
- Output: suggested title, date and venue, validated before display and labelled as suggestions. A date that does not parse is left blank. The organiser corrects and confirms the form before anything is saved.
- When it fails: a five-second timeout, missing GEMINI_API_KEY, 429, provider error or malformed output leaves manual entry available and shows a readable notice. No automatic save and no retry loop. Tests inject a fake client.

## Auth
<!-- Local sign-in plus at least one provider. Say how an account signing in both ways stays one account. -->
- Local: email/password with salted scrypt hashes; opaque random session cookie with HttpOnly, SameSite=Lax, Path=/ and Secure under HTTPS. Only the SHA-256 session-token digest is stored in the database; sessions expire after eight hours and logout revokes them.
- Provider: Google OAuth authorization-code flow with state and PKCE, implemented in Exercise 3; it creates the same ordinary session as local sign-in.
- Linking: first match the provider's stable account ID; link an existing email account only when Google marks that email verified. Never merge an unverified address. Provider sign-in was added in Exercise 3; automated tests use an injected client.
- Permissions: signed-in members browse events and manage their own registrations; organisers manage only events they own for their club. Services enforce these rules; organisers have no blanket access to other people's sessions or registrations.

## MCP tools
<!-- At least three tools your own MCP server exposes over this project's data.
     Each tool calls the same service functions the HTTP API calls, so the same rules apply.
     A description shorter than 20 characters is not a description. -->
| Tool | What it does | Who may call it |
| --- | --- | --- |
| upcoming_events | Lists future club events with their dates, venues and remaining capacity | signed-in member |
| my_registrations | Lists the upcoming event registrations belonging to the session owner | the token's owner |
| register | Registers the session owner for an event, refusing full or duplicate sign-ups | the token's owner |
| cancel_registration | Cancels only a registration owned by the member whose token was supplied | the registration's owner |

These four project tools extend Exercise 1's two tools. Each calls the same service function as HTTP. MCP_TOKEN carries an ordinary session, never an admin credential.

## UI
<!-- Stack, and the three or more screens. The graded checklist lives in docs/UI.md. -->
Plain HTML, CSS tokens and browser JavaScript calling the REST API. Implemented screens: sign in, upcoming events, event details/my registration, and organiser event editor with poster assistance. Slice 1 built sign in and the upcoming-events list; Slice 2 adds details, registration actions and the organiser editor.

All screens must support loading, empty, error and success states, keyboard operation with visible focus, labelled inputs, 44px touch targets, measured 4.5:1 text contrast, and no page overflow at 380/768/1280px. Use a light agenda layout with a date block for each event; no dark mode in Slice 1 to keep one palette thoroughly checked. Track the final checklist in docs/UI.md during Exercise 4.

## Architecture
A registration starts in src/web/event.js: the button calls the shared request wrapper in src/web/api.js, which sends POST /api/registrations with the event ID. The browser disables the action during the request and presents a readable success or error state. HTML shells come from the server; JavaScript renders event data using textContent.

src/routes/app.js reads the session cookie and JSON body, then calls src/services/registrations.js. The route translates AppError codes into HTTP statuses, including 401, 403 and 409. It does not decide capacity or registration ownership. The service identifies the caller through src/services/auth.js and checks the event date, existing registration and remaining places.

src/data/repository.js owns the parameterised SQL and executes the registration transaction against SQLite. migrations/002_feature_integrity.sql adds database capacity protection as a second integrity boundary. A successful service result becomes a 201 JSON response; the browser reloads event details so the registration action and remaining-place count reflect stored data. Cancellation follows the same layers and checks the registration owner before deleting its row.

mcp-server/project-tools.js passes MCP_TOKEN to these same service functions. It cannot bypass the date, capacity or ownership rules. src/application.js composes the services for MCP; the HTTP app composes the same implementations. Model calls live in src/model/poster-client.js; src/services/poster.js validates suggestions and chooses manual fallback. Provider exchange lives in src/auth/google-client.js, while src/services/provider-auth.js handles linking and ordinary session creation.

One remaining inconsistency is browser request handling: the original src/web/login.js and src/web/events.js still make their own fetch calls, while the new detail/editor screens use src/web/api.js. Keeping those working Slice 1 paths avoided a refactor unrelated to the new feature; server business rules still have one implementation. The browser maintains form and request state in the DOM rather than using a frontend framework.

## Acceptance criteria
<!-- Every criterion carries an id. A test proves it by naming that id in its title, for example
     test('AC-3 a booking that overlaps another is refused with 409', ...).
     Say who acts, what they see, and what must be true in the database. -->
- [AC-1] A signed-in member sees only events strictly after the current instant, ordered by start time, with title, club, date/time displayed in Europe/Sofia, venue and free places calculated from registrations.
- [AC-2] A member registering for a full event receives 409 and "This event is full"; no registration is inserted.
- [AC-3] A member registering twice receives 409; exactly one registration links that member and event.
- [AC-4] A member cancelling their registration frees one place; a different member attempting cancellation receives 403 and the row stays unchanged.
- [AC-5] An organiser saves a valid event for their club and sees its details; another member attempting to edit it receives 403 and the stored event stays unchanged.
- [AC-6] Google sign-in with a verified email matching a local account opens that same account with no duplicate user; an unverified email never links to that account.
- [AC-7] An organiser uploading a poster sees validated title/date/venue suggestions, labelled as suggestions; no event is saved until they confirm. An invalid date remains blank.
- [AC-8] With no model key, a timeout or a 429 response, poster assistance shows a readable failure notice and leaves manual event entry usable without saving an event.
- [AC-9] The MCP register tool, acting as the member's session, rejects a full event with the same rule and message as HTTP and inserts no row.

### Slice 1: sign-in and the upcoming events list
- [AC-10] A signed-out visitor requesting /events is redirected to /login; GET /api/events returns 401 and exposes no event data.
- [AC-11] A member signing in with a seeded account reaches /events and sees the three seeded future events with their title, date, venue, club and free places.
- [AC-12] Removing an event in an isolated verification database and reloading the list removes that event from the response; restarting the app does not recreate it.
- [AC-13] Invalid credentials produce 401 and "Email or password is incorrect" without creating a session; correct credentials create a session whose database row stores only the token's hash.
- [AC-14] Signing out invalidates the session in the database, returns the member to /login and makes the old session receive 401 on /api/events.
- [AC-15] When no future events exist, the list explains that nothing is scheduled; while loading it announces progress, and a failed request shows a readable message and Retry.

### Slice 2: register for and manage club events
- [AC-16] A signed-in member registering for a future event with a free place receives 201, sees their registration and reduces free places by one.
- [AC-17] Registering for a past event receives 409; no registration is inserted.
- [AC-18] Signed-out registration/cancellation receives 401; another member cancelling the registration receives 403 and the row remains unchanged.

## Traceability
<!-- Filled in from Exercise 3 onward: each AC id, and the test that names it. -->
| Criterion | Test |
| --- | --- |
| AC-1 | test/auth.test.js; test/api.test.js |
| AC-16 | test/registrations.test.js; test/feature-api.test.js; test/web.test.js |
| AC-17 | test/registrations.test.js; test/feature-api.test.js |
| AC-18 | test/registrations.test.js; test/feature-api.test.js |
| AC-2 / AC-3 / AC-4 | test/registrations.test.js; test/feature-api.test.js |
| AC-5 | test/event-management.test.js; test/feature-api.test.js |
| AC-6 | test/provider.test.js |
| AC-7 / AC-8 | test/poster.test.js; test/web.test.js |
| AC-9 | test/mcp.test.js |
| AC-10 | test/api.test.js |
| AC-11 | test/database.test.js; test/api.test.js; test/web.test.js |
| AC-12 | test/api.test.js; test/persistence.test.js |
| AC-13 | test/auth.test.js; test/api.test.js; test/web.test.js |
| AC-14 | test/auth.test.js; test/api.test.js |
| AC-15 | test/api.test.js; test/web.test.js |

AC-2 through AC-9 were implemented and tested in Exercise 3.

## Spec vs result
- Manual verification: the localhost checklist was completed on 2026-11-20.
- Automated evidence: AC-1 and AC-10 through AC-15 pass in service, real HTTP, persistence and browser-script tests. Removal/restore uses isolated data; reopening the file database does not recreate a removed event.
- Missed or reinterpreted: the original spec did not choose a display timezone; the implementation chose Europe/Sofia. The first mobile screenshot also wrapped the product name and sign-out control awkwardly; the layout was corrected.
- Changed after checking: AC-1 now explicitly requires Europe/Sofia display and a strictly future instant; UTC remains the storage/API format. The tested 16:00 UTC to 18:00 Sofia conversion is now a requirement rather than an accidental browser decision.
- Exercise 3: registration/cancellation, organiser editing, Google linking, poster assistance and project MCP tools now have automated evidence. External Google/model calls were not performed; tests inject clients. The available browser could not connect to the isolated local preview, so the new screens still need a manual localhost check.
<!-- After the agent builds the slice: which criteria passed, which it missed or reinterpreted, and what you changed in this spec because of it. -->
