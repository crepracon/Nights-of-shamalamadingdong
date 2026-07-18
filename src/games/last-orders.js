// games/last-orders.js — "Last Orders" as a box resident.
// Wraps the round.js internals (which keep their own tests) in the
// standard mini-game interface. Content still comes from the location.

import {
  createRound,
  advance as advanceRound,
  recordAnswer,
  everyoneAnswered,
  results as roundResults,
} from "../round.js";
import { tavern } from "../content/tavern.js";

const QUESTION_MS = 15000;

// Longer stories earn more reading time: ~350ms per word, clamped 15-60s.
function narrationTime(text) {
  const words = text.split(/\s+/).length;
  return Math.min(60000, Math.max(15000, words * 350));
}

export const lastOrders = {
  id: "last-orders",
  name: "Last Orders",

  create(playerIds, rng = Math.random) {
    return createRound(playerIds, tavern, rng);
  },

  phase(state) {
    if (state.phase === "narration") {
      return {
        key: "narration",
        kind: "story",
        durationMs: narrationTime(state.narration),
        acceptsInput: false,
        broadcast: { text: state.narration, progress: "Pay attention…" },
      };
    }
    if (state.phase === "question") {
      const q = state.questions[state.currentQuestion];
      return {
        key: `q${state.currentQuestion}`,
        kind: "choices",
        durationMs: QUESTION_MS,
        acceptsInput: true,
        broadcast: {
          prompt: q.question,
          options: q.options, // correctAnswer stays server-side
          progress: `Question ${state.currentQuestion + 1} of ${state.questions.length}`,
        },
      };
    }
    return null; // results reached — game over
  },

  advance(state) {
    advanceRound(state);
  },

  input(state, playerId, choice, timeMs) {
    return recordAnswer(state, playerId, state.currentQuestion, choice, timeMs);
  },

  everyoneActed(state) {
    return everyoneAnswered(state);
  },

  results(state) {
    return roundResults(state).map((r) => ({
      playerId: r.playerId,
      points: r.points,
      label: `${r.correct}/${state.questions.length} correct`,
    }));
  },
};
