// games/smugglers-boxes.js — "The Smuggler's Boxes", asymmetric bluffing.
//
// One random player is the SMUGGLER. They secretly stash 10 trinkets
// across 5 boxes (0-4 per box). Three boxes get inspected, one at a time:
// the smuggler announces a count for the box — truth or lie — and everyone
// else guesses the REAL count. Right guesses score.
// The smuggler doesn't score: lying to your friends is its own reward.
//
// The stash total (10) is public, so revealed boxes let sharp guessers
// do arithmetic against later claims.

import { rankRound } from "../scoring.js";

const STASH = 10;
const BOX_COUNT = 5;
const MAX_PER_BOX = 4;
const INSPECTIONS = 3;

const HIDE_MS = 10000;
const CLAIM_MS = 10000;
const GUESS_MS = 12000;
const REVEAL_MS = 6000;

// Valid range for the box being filled, so the stash always fits:
// you can't leave more trinkets than the remaining boxes can hold.
function hideRange(state) {
  const placed = state.boxes.reduce((sum, b) => sum + (b ?? 0), 0);
  const remaining = STASH - placed;
  const boxesAfter = BOX_COUNT - 1 - state.hideIndex;
  return {
    min: Math.max(0, remaining - MAX_PER_BOX * boxesAfter),
    max: Math.min(MAX_PER_BOX, remaining),
  };
}

function numberOptions(min, max) {
  const options = [];
  for (let n = min; n <= max; n++) options.push(String(n));
  return options;
}

export const smugglersBoxes = {
  id: "smugglers-boxes",
  name: "The Smuggler's Boxes",

  create(playerIds, rng = Math.random) {
    const hider = playerIds[Math.floor(rng() * playerIds.length)];
    // Pick 3 distinct boxes to inspect.
    const order = [...Array(BOX_COUNT).keys()].sort(() => rng() - 0.5);
    return {
      playerIds: [...playerIds],
      hider,
      boxes: Array(BOX_COUNT).fill(null),
      hideIndex: 0,
      inspect: order.slice(0, INSPECTIONS),
      round: 0,
      claims: [],
      guesses: Array.from({ length: INSPECTIONS }, () => ({})),
      step: "hide",
      done: false,
      rng,
    };
  },

  phase(state) {
    if (state.done) return null;
    const progress = `The Smuggler's Boxes — ${STASH} trinkets hidden`;

    if (state.step === "hide") {
      const { min, max } = hideRange(state);
      return {
        key: `hide${state.hideIndex}`,
        kind: "choices",
        durationMs: HIDE_MS,
        acceptsInput: true,
        broadcast: { options: [], progress, prompt: "The smuggler is stuffing boxes…" },
        _range: { min, max }, // internal, used by personal/input
      };
    }
    const box = state.inspect[state.round];
    if (state.step === "claim") {
      return {
        key: `claim${state.round}`,
        kind: "choices",
        durationMs: CLAIM_MS,
        acceptsInput: true,
        broadcast: {
          options: [],
          progress,
          prompt: `The smuggler eyes Box ${box + 1} and prepares a claim…`,
          table: revealedSoFar(state),
        },
      };
    }
    if (state.step === "guess") {
      return {
        key: `guess${state.round}`,
        kind: "choices",
        durationMs: GUESS_MS,
        acceptsInput: true,
        broadcast: {
          options: numberOptions(0, MAX_PER_BOX),
          progress,
          prompt: `The smuggler swears Box ${box + 1} holds ${state.claims[state.round]}. The truth?`,
          table: revealedSoFar(state),
        },
      };
    }
    // reveal
    const actual = state.boxes[box];
    const claim = state.claims[state.round];
    const rightCount = Object.values(state.guesses[state.round]).filter(
      (g) => g.value === actual
    ).length;
    return {
      key: `reveal${state.round}`,
      kind: "story",
      durationMs: REVEAL_MS,
      acceptsInput: false,
      broadcast: {
        progress,
        text:
          `Box ${box + 1} held ${actual}! The claim of ${claim} was ` +
          (claim === actual ? "the truth. " : "a LIE. ") +
          (rightCount === 0
            ? "Nobody guessed it."
            : `${rightCount} guesser${rightCount === 1 ? "" : "s"} saw through the smuggler.`),
      },
    };
  },

  personal(state, playerId) {
    const isHider = playerId === state.hider;
    if (state.step === "hide") {
      if (!isHider) return {};
      const { min, max } = hideRange(state);
      return {
        prompt: `Stash Box ${state.hideIndex + 1} of ${BOX_COUNT}. How many trinkets inside?`,
        options: numberOptions(min, max),
      };
    }
    if (state.step === "claim") {
      if (!isHider) return {};
      const box = state.inspect[state.round];
      return {
        prompt: `Box ${box + 1} truly holds ${state.boxes[box]}. What do you TELL them?`,
        options: numberOptions(0, MAX_PER_BOX),
      };
    }
    if (state.step === "guess" && isHider) {
      return { prompt: "You watch them squirm.", options: [] };
    }
    return {};
  },

  input(state, playerId, choice, timeMs) {
    const isHider = playerId === state.hider;
    if (state.step === "hide") {
      if (!isHider) return { ok: false, error: "Not your boxes" };
      if (state.boxes[state.hideIndex] !== null) return { ok: false, error: "Already stashed" };
      const { min, max } = hideRange(state);
      const value = min + choice;
      if (value > max) return { ok: false, error: "Won't fit" };
      state.boxes[state.hideIndex] = value;
      return { ok: true };
    }
    if (state.step === "claim") {
      if (!isHider) return { ok: false, error: "Not your claim to make" };
      if (state.claims[state.round] !== undefined) return { ok: false, error: "Already claimed" };
      state.claims[state.round] = choice;
      return { ok: true };
    }
    if (state.step === "guess") {
      if (isHider) return { ok: false, error: "You know the answer" };
      if (state.guesses[state.round][playerId]) return { ok: false, error: "Already guessed" };
      state.guesses[state.round][playerId] = { value: choice, timeMs };
      return { ok: true };
    }
    return { ok: false, error: "Nothing to do" };
  },

  everyoneActed(state) {
    if (state.step === "hide") return state.boxes[state.hideIndex] !== null;
    if (state.step === "claim") return state.claims[state.round] !== undefined;
    if (state.step === "guess") {
      return state.playerIds
        .filter((id) => id !== state.hider)
        .every((id) => state.guesses[state.round][id]);
    }
    return false;
  },

  advance(state) {
    if (state.step === "hide") {
      if (state.boxes[state.hideIndex] === null) {
        state.boxes[state.hideIndex] = hideRange(state).min; // silence stashes the minimum
      }
      state.hideIndex += 1;
      if (state.hideIndex >= BOX_COUNT) state.step = "claim";
      return;
    }
    if (state.step === "claim") {
      if (state.claims[state.round] === undefined) {
        state.claims[state.round] = state.boxes[state.inspect[state.round]]; // silence tells the truth
      }
      state.step = "guess";
      return;
    }
    if (state.step === "guess") {
      state.step = "reveal";
      return;
    }
    // reveal
    state.round += 1;
    if (state.round >= INSPECTIONS) state.done = true;
    else state.step = "claim";
  },

  results(state) {
    const guessers = state.playerIds
      .filter((id) => id !== state.hider)
      .map((playerId) => {
        let correct = 0;
        let totalTimeMs = 0;
        state.inspect.forEach((box, i) => {
          const guess = state.guesses[i][playerId];
          if (!guess) return;
          totalTimeMs += guess.timeMs;
          if (guess.value === state.boxes[box]) correct += 1;
        });
        return { playerId, correct, totalTimeMs };
      });

    const ranked = rankRound(guessers).map((r) => ({
      playerId: r.playerId,
      points: r.points,
      label: `${r.correct}/${INSPECTIONS} seen through`,
    }));

    ranked.push({ playerId: state.hider, points: 0, label: "ran the smuggle" });
    return ranked;
  },
};

function revealedSoFar(state) {
  const parts = [];
  for (let i = 0; i < state.round; i++) {
    const box = state.inspect[i];
    parts.push(`Box ${box + 1}: ${state.boxes[box]}`);
  }
  return parts.length
    ? `Opened so far (of ${STASH} total): ${parts.join(" | ")}`
    : `${STASH} trinkets across ${BOX_COUNT} boxes. None opened yet.`;
}
