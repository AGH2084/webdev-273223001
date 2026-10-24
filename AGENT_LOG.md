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

## 2026-10-25 · Set up the Codex MCP run command
- Goal: Connect the Codex client to the lecture MCP server, record the description experiment, and add a reliable npm start command.
- Delegated: None.
- Checkpoints: Codex listed `my-project` and its two tools; a direct request called `find_lecture`; `node mcp-server/check.mjs -- cmd.exe /d /c npm run --silent mcp` passed 12/12.
- Went wrong: A generic lecture question was answered from local files instead of using MCP. PowerShell blocked `npm.ps1`, and the self-check could not spawn `npm.cmd` directly; using `cmd.exe /d /c` worked.
- Changed by hand: Added `.codex/config.toml`, made the `find_lecture` description more specific, recorded the experiment in `mcp-server/README.md`, and added the `mcp` script in `package.json`.
