// scores.js — the game-night scoreboard that persists across rounds.
// Round points flow IN after each mini-game; the shop will spend them OUT.

export function createStandings() {
  return {}; // playerId -> total points
}

export function applyRoundPoints(standings, rankedResults) {
  for (const r of rankedResults) {
    standings[r.playerId] = (standings[r.playerId] ?? 0) + r.points;
  }
}

// Move points between players (Pickpocket). Never goes below zero —
// you can't steal what someone doesn't have.
export function transferPoints(standings, fromId, toId, amount) {
  const available = Math.min(standings[fromId] ?? 0, amount);
  standings[fromId] = (standings[fromId] ?? 0) - available;
  standings[toId] = (standings[toId] ?? 0) + available;
  return available;
}

// For the future shop.
export function spendPoints(standings, playerId, cost) {
  if ((standings[playerId] ?? 0) < cost) {
    return { ok: false, error: "Not enough points" };
  }
  standings[playerId] -= cost;
  return { ok: true };
}

export function total(standings, playerId) {
  return standings[playerId] ?? 0;
}
