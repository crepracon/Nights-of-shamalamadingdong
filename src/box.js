// box.js — the box of mini-games.
// Every game in the box implements the same interface:
//
//   id, name        — identity
//   create(playerIds, rng) -> state      — a fresh round of this game
//   phase(state) -> descriptor | null    — the CURRENT phase:
//       { key, kind: "story"|"choices", durationMs, acceptsInput,
//         broadcast: { text? | prompt?, options?, progress? } }
//       (null when the game is finished)
//   advance(state)                       — move to the next phase
//   input(state, playerId, choice, timeMs) -> { ok, error? }
//   everyoneActed(state) -> bool         — lets the engine skip the clock
//   results(state) -> [{ playerId, points, label }] ranked best-first
//
// The engine (server) owns clocks, sockets, standings, and cards.
// Games own their content, rules, and scoring.

export function createBox(games) {
  if (!games.length) throw new Error("The box can't be empty");
  return { games };
}

// Draw a random game, avoiding the one just played when possible.
export function drawGame(box, lastGameId = null, rng = Math.random) {
  const pool =
    box.games.length > 1
      ? box.games.filter((g) => g.id !== lastGameId)
      : box.games;
  return pool[Math.floor(rng() * pool.length)];
}
