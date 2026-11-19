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

## What the agent did that I did not ask for
- Added focused tests for sign-in, data persistence, HTTP and browser-script states so the slice has checkable evidence.
- Used optional visual-inspection tooling during verification; removed it and the separate plan/checks documents after review because Exercise 2 does not require those files.
- Added explicit local demo-password rotation so a lost generated password does not require deleting the database or reseeding events.
- Removed an unnecessary re-login session-rotation branch from the HTTP handler; ownership/session rules stay in services.
- Used a compact header instead of the design sheet's sidebar because this slice has one destination.
- Kept final coverage thresholds unchanged and enforced them from the custom coverage command so the existing CI custom-script path cannot silently skip its gates.
