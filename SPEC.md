# Club Calendar

<!-- Exercise 2. Write the non-goals first. Every acceptance criterion must be checkable in under a minute.
     Keep these headings exactly as they are: the self-checks look for them by name.
     The full target is on the course site under Resources → The course project. -->

## Project option
<!-- One line: lab booking, study groups, club events, or the own project the lecturer approved. -->
Club events.

## Goals
- A member signs in, browses upcoming club events and reserves or cancels their own place.
- An organiser creates and edits their events, sets capacity, sees their attendee list and deletes their own events.

## Non-goals
- No payments or paid tickets: every event is free.
- No email or push notifications: members check the website.
- No native mobile application: the web interface also works on phones.
- No public email/password sign-up or organiser self-registration form. Local demonstration accounts are explicitly seeded; first-time verified Google sign-in creates a member account.

## Constraints
- Node.js 22.13 or newer, built-in HTTP/crypto/SQLite modules, plain HTML/CSS/JavaScript; no external runtime dependencies.
- SQLite is the local database for Exercises 2 and 3. Move the data adapter and migrations to PostgreSQL before the persistent Neon deployment in Exercise 4.
- Numbered migrations, parameterised SQL only in src/data/, and business rules only in src/services/.
- Passwords are salted scrypt hashes. No credentials, personal prompts or raw session tokens in application logs or committed configuration. The explicit local seed command displays a newly generated fictional demo-account password once for the developer.
- Final coverage gates: 100% of service lines, functions and branches; at least 80% overall. Every AC has a named test by Exercise 3.

## The model feature
<!-- Which model, which modality, and what it does for a user.
     Name three things or the check fails: the input it receives, the output it produces,
     and what happens when the model is slow, rate-limited or wrong. -->
- Model: Gemini 3.5 Flash-Lite, vision, selected through MODEL_NAME=gemini-3.5-flash-lite. Poster extraction helps organisers fill event forms from an image. The adapter is src/model/poster-client.js; the implementation still defaults to the older gemini-2.5-flash if MODEL_NAME is omitted, so explicit configuration is required for the chosen model. GEMINI_API_KEY is supplied privately through the server environment.
- Input: one PNG or JPEG poster up to 1 MB, explicitly selected by an organiser and sent to Google's hosted API only after upload consent. No member profiles, passwords, sessions or attendee lists are sent. The poster is used for extraction, not stored as an event attachment. Remove poster clears the local selection and consent and ignores outstanding suggestions without changing event fields.
- Output: suggested title, start date/time, venue, capacity and description, validated by src/services/poster.js before display and labelled as suggestions. Title and venue are plain text limited to 120 and 160 characters. Capacity is accepted only as an integer from 1 to 5000; description is plain text limited to 2000 characters. Missing or invalid capacity/description suggestions leave existing form values unchanged.
- Date handling: the model is instructed to return a UTC date/time only when the poster explicitly supplies the date, time and timezone. Missing, malformed or invalid dates leave the date field blank; no timezone is assumed. The organiser must correct past dates before saving because events require a future start time.
- Confirmation: suggestions fill the form only. The organiser reviews and corrects all fields and chooses Confirm and save event before anything is saved; the normal event validation and ownership rules still apply.
- When it fails: provider and service calls have a 30-second timeout; the browser allows 35 seconds for the poster response. Missing GEMINI_API_KEY, denied access, an unavailable model, rate limiting or exhausted quota, timeout, provider failure or unusable output shows a readable notice and leaves manual entry usable. There is no automatic save or retry loop. Tests inject fake clients and cover valid suggestions, invalid fields and failure fallbacks without contacting Google.

## Auth
<!-- Local sign-in plus at least one provider. Say how an account signing in both ways stays one account. -->
- Local: email/password with salted scrypt hashes; opaque random session cookie with HttpOnly, SameSite=Lax, Path=/ and Secure under HTTPS. Only the SHA-256 session-token digest is stored in the database; sessions expire after eight hours and logout revokes them.
- Provider: Google OAuth authorization-code flow with state and PKCE, implemented in Exercise 3; it creates the same ordinary session as local sign-in.
- Linking: first match the provider's stable account ID; link an existing email account only when Google marks that email verified. Never merge an unverified address. Provider sign-in was added in Exercise 3; automated tests use an injected client.
- Account creation: the explicit seed creates the demo member, organiser and club. New verified Google identities create members; linking to an existing account preserves its role. There is no organiser invitation/promotion interface.
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

These four project tools extend Exercise 1's two lecture tools. Each project tool calls the same service function as HTTP. The server uses local stdio transport and receives an ordinary application session through MCP_TOKEN; an MCP client does not inherit the browser cookie automatically. The session must belong to the same database, expires after eight hours and is revoked by logout. No remote HTTP MCP endpoint or MCP OAuth authorization flow is implemented.

## UI
<!-- Stack, and the three or more screens. The graded checklist lives in docs/UI.md. -->
Plain HTML, CSS tokens and browser JavaScript calling the REST API. Implemented screens: sign in, upcoming events, event details/my registration, and organiser event editor with poster assistance. Slice 1 built sign in and the upcoming-events list; Slice 2 adds details, registration actions and the organiser editor.

All screens must support loading, empty, error and success states, keyboard operation with visible focus, labelled inputs, 44px touch targets, measured 4.5:1 text contrast, and no page overflow at 380/768/1280px. Use a light agenda layout with a date block for each event; no dark mode in Slice 1 to keep one palette thoroughly checked. Track the final checklist in docs/UI.md during Exercise 4. Club, title, date/time, venue and places are labelled required; description is optional. Save errors identify the failing field and appear above the save button, receive focus and scroll into view. The editor accepts device-local date/time and converts it to UTC; event displays use Europe/Sofia.

## Architecture
One registration request crosses both browser and server layers:

1. src/web/event.html supplies the view. In src/web/event.js, registrationAction(false) calls window.ClubAPI from src/web/api.js with POST /api/registrations and { eventId }. The browser holds registrationId in a script variable and view/request state in the DOM; buttons are disabled while the request runs.
2. src/routes/app.js reads the club_session cookie, checks authentication before protected writes, parses JSON and calls registrationsService.register(token, eventId) from src/services/registrations.js. The route maps AppError codes to statuses; it does not decide capacity, event dates or registration ownership.
3. The service calls auth.requireUser from src/services/auth.js and repository.transaction from src/data/repository.js. Inside BEGIN IMMEDIATE, it checks the event exists, has not started, is not already registered by this user and has capacity, then calls repository.addRegistration. All runtime SQL lives in src/data/. SQLite applies the unique member/event relation from migrations/001_initial.sql and capacity triggers from migrations/002_feature_integrity.sql as integrity boundaries.
4. The successful service result is { id, userId, eventId }, returned as HTTP 201 JSON. ClubAPI parses it or throws a readable error on failure. event.js then calls loadDetail(), reads GET /api/events/:id and renders the event, free-place count and registration action with textContent. Detail data includes { event, canEdit, registrationId, attendees }; attendee names are returned only to the event-owning organiser.
5. Cancellation uses registrationsService.cancel(token, registrationId), checks ownership in the service, deletes the registration inside a transaction and returns HTTP 204. Event deletion similarly enters eventManagement.remove in src/services/event-management.js after UI confirmation, checks organiser/event ownership and calls repository.removeEvent; the database cascades deletion to that event's registrations.

For MCP, mcp-server/server.js reads MCP_TOKEN from the process environment and dispatches to callProjectTool in mcp-server/project-tools.js. src/application.js composes the same eventsService and registrationsService implementations used by HTTP. MCP register/cancel therefore enters at the service layer and enforces the same rules, returning MCP isError results rather than HTTP statuses. The two retained lecture tools read lectures.json separately and do not access project data.

Poster requests start in src/web/editor.js, use ClubAPI and enter posterService.read in src/services/poster.js via the route. Only src/model/poster-client.js contacts the model; the service validates the returned fields and supplies manual fallback. The browser fills suggestions without saving; explicit form submission invokes eventManagement.create/edit and its validation. Provider exchange is isolated in src/auth/google-client.js; src/services/provider-auth.js controls verified identity linking and ordinary session issuance.

One layering inconsistency remains: src/web/login.js and src/web/events.js make their own fetch calls, while the detail/editor screens use src/web/api.js. The existing working paths were retained to avoid an unrelated refactor. Browser-side disabling is feedback only; service validation is authoritative even if requests bypass the UI.

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
- [AC-7] An organiser uploading a poster sees validated title/date/venue/capacity/description suggestions, labelled as suggestions; no event is saved until they confirm. An invalid date remains blank.
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

- [AC-19] An event-owning organiser confirms deletion and receives 204; the event and its registrations disappear. Signed-out deletion returns 401, a member or another organiser receives 403 without changing data, and a missing event returns 404.
- [AC-20] An organiser can remove a selected poster without reloading: the file input and upload consent clear, existing event fields remain unchanged, and an outstanding suggestion cannot repopulate them after removal. No event or saved data is deleted by this action.

## Traceability
<!-- Filled in from Exercise 3 onward: each AC id, and the test that names it. -->
| Criterion | Test |
| --- | --- |
| AC-19 | test/event-management.test.js; test/feature-api.test.js; test/web.test.js |
| AC-20 | test/web.test.js |
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
- Exercise 2 manual verification: the localhost checklist was completed on 2026-11-20; this does not claim completion of the Exercise 3 manual checklist.
- Automated evidence: AC-1 and AC-10 through AC-15 pass in service, real HTTP, persistence and browser-script tests. Removal/restore uses isolated data; reopening the file database does not recreate a removed event.
- Missed or reinterpreted: the original spec did not choose a display timezone; the implementation chose Europe/Sofia. The first mobile screenshot also wrapped the product name and sign-out control awkwardly; the layout was corrected.
- Changed after checking: AC-1 now explicitly requires Europe/Sofia display and a strictly future instant; UTC remains the storage/API format. The tested 16:00 UTC to 18:00 Sofia conversion is now a requirement rather than an accidental browser decision.
- Exercise 3 automated evidence: 49 tests pass, with 100% service lines/functions/branches and 95.49% overall lines at the last full coverage run. The exercise self-check passed 18/18 and MCP protocol conformance passed 12/12. These results do not establish browser layout quality or live provider behavior.
- Exercise 3 manual evidence reported on 2026-11-21: Google sign-in works; live poster extraction filled title and venue; form error visibility and required labels were confirmed. OpenCode MCP testing confirmed listing, registration, duplicate refusal and cancellation, restoring the original registration/place-count state. The latest complete manual checklist, full-event/other-user/invalid-session MCP checks and live capacity/description extraction remain for confirmation.
- Known differences requiring review: my_registrations currently returns all of the owner's registrations, although its specified behavior above says upcoming. The event screen can re-enable Register after certain failed requests even when an event has started; the service still refuses it. Lecture tools retain a 1–12 description/error although lectures.json contains 1–10. These discrepancies have not been resolved by changing the requirements.
- Deployment: local Exercise 3 work has not been pushed; remote CI results are pending. SQLite-to-PostgreSQL deployment and the final UI audit remain Exercise 4 work.

<!-- After the agent builds the slice: which criteria passed, which it missed or reinterpreted, and what you changed in this spec because of it. -->
