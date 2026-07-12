# Nights of Shabalabadingdong

A browser-based multiplayer party game. Medieval fantasy, social deduction,
puzzles, and random chaos. Players join from their own devices.

## Run it locally

```
npm install
npm start
```

Then open http://localhost:3000 — on your phone too, if it's on the same
Wi-Fi (use the computer's local IP instead of localhost).

## Run the tests

```
npm test
```

## What exists so far

- **Lobby** — players join with a name; first player in is the host and can
  start the game with 2+ players.
- **Core mini-game logic** (not yet wired to the server):
  - `src/template.js` — fills `[tag]` story templates from word lists and
    records the picks (the answer key).
  - `src/questions.js` — turns an answer key into 4-option multiple-choice
    questions.
  - `src/scoring.js` — ranks a round's answers, speed breaks ties.

## Deploy

Not deployed yet. When it's time: the server is a plain Node app
(`node server.js`, listens on `PORT` env var or 3000) — fits Render/Railway
free tiers. Remember: never commit secrets; `.env` is gitignored.

## Known gaps (on purpose, for now)

- One global lobby; no way to reset to lobby after a game starts
  (restart the server instead).
- The "started" screen is a placeholder — the mini-game loop plugs in next.
