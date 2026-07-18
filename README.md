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

Set `FAST_MODE=1` to run every clock at 10x speed for quick testing:

```
FAST_MODE=1 npm start
```

## Run the tests

```
npm test
```

## What exists so far

- **Lobby** — players join with a name; first in is the host ("innkeeper")
  and starts the game with 2+ players.
- **Stable identity + reconnect** — each player gets a token saved in their
  browser. A refresh reconnects to the same seat, role, hand, and points
  instead of dropping the player. The server keys all state on this token
  (`pid`), never the throwaway socket id.
- **Secret roles** — dealt once a night via the Wheel of Fates reveal. You
  learn only your own fate; everyone else is a guess. (`src/roles.js`)
- **Three mini-games in the box** — Last Orders, Dice Pot, Smuggler's Boxes.
  The engine draws one each round through a shared interface. (`src/box.js`,
  `src/games/`)
- **Card engine** — trap/trick cards won as rank prizes, played during the
  post-round gathering. (`src/cards.js`)
- **Scoreboard** — points persist across rounds; cards can move them.
  (`src/scores.js`)

## Deploy (Render, free tier)

- Build command: `npm install`
- Start command: `npm start` (the server reads `PORT` from the environment)
- Never commit secrets; `.env` is gitignored.

## Known gaps (on purpose, for now)

- One global lobby; no reset-to-lobby after a game ends (restart the server).
- Role *powers* aren't implemented yet — roles are assigned and revealed, but
  don't do anything mechanically.
- If the **host** disconnects mid-game they keep the crown (so their role and
  points survive a refresh). If they never return, the gathering phase can
  only end on its own timer — nobody else can ring the bell.
- A player who leaves mid-game (rather than refreshing) lingers as a
  disconnected seat until the game ends.
