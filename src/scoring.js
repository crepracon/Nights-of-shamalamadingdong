// scoring.js — ranks players for a mini-game round.
//
// Input: one entry per player:
//   { playerId, correct: <number of right answers>, totalTimeMs: <sum of answer times> }
//
// Rules:
//   - More correct answers ranks higher.
//   - Ties broken by speed (lower total time wins).
//   - Points by rank: 1st = 100, 2nd = 80, 3rd = 60, then 40 for everyone else
//     who got at least one answer right. Zero correct = zero points.
//
// Returns entries sorted best-first, each with rank and points added.

const POINTS_BY_RANK = [100, 80, 60];
const PARTICIPATION_POINTS = 40;

export function rankRound(results) {
  const sorted = [...results].sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.totalTimeMs - b.totalTimeMs;
  });

  return sorted.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    points:
      entry.correct === 0
        ? 0
        : POINTS_BY_RANK[i] ?? PARTICIPATION_POINTS,
  }));
}
