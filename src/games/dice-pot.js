// games/dice-pot.js — "The Dice Pot", push-your-luck gambling.
//
// Everyone starts with an automatic roll of 2 dice (that's your score).
// Each round, choose: ROLL again or STAND.
//   - Roll STRICTLY higher than your last roll: add it to your score.
//   - Roll equal or lower: BUST. Score to zero. Out.
//   - Stand: bank your score and watch the greedy suffer.
// No decision before the clock runs out = you stand (mercy rule).
// Highest banked score wins. Busts score nothing.

const DECISION_MS = 12000;
const MAX_ROUNDS = 15; // safety cap; games practically never reach it

function rollDice(rng) {
  return 1 + Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6);
}

export const dicePot = {
  id: "dice-pot",
  name: "The Dice Pot",

  create(playerIds, rng = Math.random) {
    const players = {};
    for (const id of playerIds) {
      const first = rollDice(rng);
      players[id] = { status: "in", score: first, lastRoll: first, intent: null };
    }
    return { players, round: 1, rng, done: false };
  },

  phase(state) {
    if (state.done) return null;
    const table = Object.entries(state.players)
      .map(([, p]) =>
        p.status === "bust" ? "BUST" : `${p.score}${p.status === "stood" ? " ✋" : ""}`
      )
      .join(" | ");
    return {
      key: `round${state.round}`,
      kind: "choices",
      durationMs: DECISION_MS,
      acceptsInput: true,
      broadcast: {
        options: ["🎲 Roll again", "✋ Stand"],
        progress: `The Dice Pot — round ${state.round}`,
        table: `The table: ${table}`,
      },
    };
  },

  // Per-player flavor merged into the broadcast by the engine.
  personal(state, playerId) {
    const p = state.players[playerId];
    if (!p) return {};
    if (p.status === "bust") {
      return { prompt: "BUST! The goblin bookie sweeps your coins." };
    }
    if (p.status === "stood") {
      return { prompt: `You stand at ${p.score}. Watch the greedy suffer.` };
    }
    return {
      prompt: `You rolled ${p.lastRoll} — banked ${p.score}. Roll higher than ${p.lastRoll}, or lose it all.`,
    };
  },

  input(state, playerId, choice) {
    const p = state.players[playerId];
    if (!p || p.status !== "in") return { ok: false, error: "You're out of this one" };
    if (p.intent !== null) return { ok: false, error: "Already decided" };
    p.intent = choice === 0 ? "roll" : "stand";
    return { ok: true };
  },

  everyoneActed(state) {
    return Object.values(state.players).every(
      (p) => p.status !== "in" || p.intent !== null
    );
  },

  advance(state) {
    for (const p of Object.values(state.players)) {
      if (p.status !== "in") continue;
      const intent = p.intent ?? "stand"; // silence means standing
      p.intent = null;
      if (intent === "stand") {
        p.status = "stood";
        continue;
      }
      const next = rollDice(state.rng);
      if (next > p.lastRoll) {
        p.score += next;
        p.lastRoll = next;
      } else {
        p.status = "bust";
        p.score = 0;
      }
    }
    state.round += 1;
    const anyoneIn = Object.values(state.players).some((p) => p.status === "in");
    if (!anyoneIn || state.round > MAX_ROUNDS) state.done = true;
  },

  results(state) {
    const POINTS = [100, 80, 60];
    return Object.entries(state.players)
      .map(([playerId, p]) => ({ playerId, score: p.score, status: p.status }))
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({
        playerId: e.playerId,
        points: e.status === "bust" ? 0 : POINTS[i] ?? 40,
        label: e.status === "bust" ? "went bust" : `banked ${e.score}`,
      }));
  },
};
