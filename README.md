# Club Calendar

Exercise 4 local preparation uses Node.js, PostgreSQL, plain HTML/CSS/JavaScript and the shared-service MCP server. Deployment remains pending live verification. SPEC.md records the scope.

Use Node >=22.13. Install with `npm ci`. Privately configure DATABASE_URL for PostgreSQL and PUBLIC_BASE_URL for the app origin, then run:

```sh
npm run setup
npm run seed
npm start
```

`npm run setup` applies numbered PostgreSQL migrations explicitly. It does not seed. `npm run seed` is only for an explicitly chosen development database; it refuses NODE_ENV=production and displays a generated demo password once for member@example.test and organiser@example.test. Existing data is left unchanged. The old data/club-calendar.db is retained but is no longer the running app's database. Do not point development seed commands at a live database without reviewing that choice.

`npm start`, setup, seed and db commands load a private local .env if present; environment variables already set in the terminal take precedence. Never share or commit its contents. Required server settings are DATABASE_URL, and HTTPS PUBLIC_BASE_URL in production; PORT defaults to 3000 and is assigned by Render. There is no SESSION_SECRET because sessions are opaque tokens with stored hashes, not signed cookies.

Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Register PUBLIC_BASE_URL/api/auth/google/callback exactly with Google. Poster assistance needs GEMINI_API_KEY; MODEL_NAME defaults to gemini-3.5-flash-lite. Without those optional credentials, password login and manual entry remain available. Posters suggest title/date-time/venue/capacity/description, with 30-second server and 35-second browser limits. A missing timezone leaves the date blank. Nothing saves until confirmation.

Event owners can edit/delete their events; confirmed deletion also removes registrations. Remove poster clears the selected file and consent, preserving event fields. Save errors appear beside the save action.

Run `npm test`, `npm run coverage`, `node checks/ex2.mjs`, `node checks/ex3.mjs` and `node mcp-server/check.mjs -- node mcp-server/server.js`. PostgreSQL integration tests require TEST_DATABASE_URL pointing to a disposable database: they create and remove an isolated schema and must never target production. CI supplies a PostgreSQL service. SQLite remains only for historical isolated regression fixtures. Tests never call Google or Gemini.

Build: `docker build -t club-calendar .`. Run: `docker run --rm -p 3000:3000 --env-file .env club-calendar`; the image runs as an unprivileged user in production mode and therefore needs an HTTPS PUBLIC_BASE_URL. Apply migrations separately before deploying. GET /health returns 200 with database connectivity, otherwise 503 without connection details.

Local MCP: `npm run --silent mcp`, launched from a terminal with DATABASE_URL and an ordinary MCP_TOKEN from that same database. It does not automatically load .env or borrow a browser session. It supports stdio, not a remote HTTP/OAuth endpoint.

---

# Web Development course · your workspace

This repository is your workspace for the whole course: Exercise 1 in `mcp-server/`, and your project (Exercises 2–5) in the rest of it. Everything runs in your browser through GitHub Codespaces, so nothing needs to be installed on your laptop.

By the end you hand in one working application: a backend and a frontend over a real database, sign-in with a password **and** with a provider, a feature that uses a model, your own MCP server over the same data, a UI that holds up on a phone and a keyboard, and tests that trace to the criteria in your spec. The full target is on the course site under **Resources → The course project**, and the questions you will be asked about it are under **Resources → The defence**. Read both before you start Exercise 2.

## Start

1. On the course template page, click **Use this template → Create a new repository**. Make it **public** and name it `webdev-<your faculty number>`.
2. Your repository is public, so the lecturer and your Exercise 5 review partner can read it without an invitation. That also means **no keys, passwords or client secrets ever go into it**: put them in **Settings → Secrets and variables → Codespaces** instead, where the workspace picks them up as environment variables.
3. Click **Code → Codespaces → Create codespace on main**. The first start takes a few minutes while the tools are installed.
4. When the terminal shows `Workspace ready`, type `gemini` and follow the sign-in steps on the course setup page.
5. Fill in `AGENTS.md` as you go, and add one entry to `AGENT_LOG.md` and `USAGE.md` after every agent session.

The course setup page explains accounts, sign-in, free limits and what to do if something goes wrong.

## What is already here

| Path | What it is for |
|---|---|
| `.devcontainer/` | The workspace definition: Node 22, Python 3.12, SQLite, Docker, GitHub CLI, Gemini CLI |
| `.gemini/settings.json` | Tells Gemini CLI to read `AGENTS.md`, and where it finds your MCP servers (Exercise 1) |
| `.vscode/mcp.json` | The same for Copilot, if you use it (the key is `servers`) |
| `.github/workflows/ci.yml` | Runs your tests, the coverage gate, the MCP conformance check and the spec check on every push |
| `AGENTS.md` | Instructions your agent reads every session |
| `SPEC.md` | Your project specification (Exercise 2) |
| `AGENT_LOG.md`, `USAGE.md` | The logs you keep from Exercise 1 on |
| `mcp-server/` | Exercise 1, with `lectures.json`, `messages.jsonl` and the self-check `check.mjs` |
| `checks/` | One self-check per exercise: `node checks/ex2.mjs`, `ex3`, `ex4`, `ex5`, plus `project.mjs` before the defence |
| `docs/UI.md` | The UI checklist your project is graded against (Exercise 4) |
| `DEFENSE.md` | Your notes for the defence (Exercise 5) |
| `.env.example` | Every environment variable your app needs, with placeholder values |
| `course.json` | How to start your MCP server, and where your deployment answers |

## Fill in `course.json` first

Two facts about your copy that nobody can work out by reading the code:

```json
{
  "mcp": "npm run mcp",
  "liveUrl": "https://webdev-121220001.onrender.com"
}
```

`mcp` is the command that starts your MCP server, which the Exercise 1 check runs, so
add an `mcp` script to `package.json` and leave the default alone. `liveUrl` is filled
in at Exercise 4. The self-checks read both.

## Check yourself before you hand in

Each exercise ships a self-check you run from the repository root:

```bash
node mcp-server/check.mjs -- node mcp-server/server.js   # exercise 1
node checks/ex2.mjs                                       # exercise 2
node checks/ex3.mjs                                       # exercise 3
node checks/ex4.mjs https://your-app.onrender.com         # exercise 4, URL optional
node checks/ex5.mjs                                       # exercise 5
node checks/project.mjs                                   # the night before the defence
```

They check **structure**, not quality: they catch a missing section, an unwritten acceptance criterion or a fix committed without its test. Every check must pass before you hand in: an exercise that fails one comes back to you as incomplete. Passing them all is the minimum, not the point. What the work is worth is decided by the evidence you wrote down and by the defence at the end of the course, where you explain your own code.

## Showing your work

When an exercise is done, commit and push, so your work is on GitHub and CI has run on it. Then ask the assistant to check your work in the room. They go through the exercise page's **What the assistant checks** list with you, at your codespace, and either accept the exercise or tell you exactly what is still missing.

## Save your free quota

Stop the codespace when you finish (**Code → Codespaces → … → Stop codespace**) and delete codespaces you no longer need.
