// cards.js — the trap/trick card engine.
// Card DEFINITIONS are data; adding cards means adding entries, not code —
// as long as their effect type already exists (steal, whisper, timePenalty,
// shield). New effect types need engine support.

export const CARDS = {
  pickpocket: {
    id: "pickpocket",
    name: "Pickpocket",
    rarity: "common",
    kind: "instant",
    needsTarget: true,
    description: "Steal 15 points from another traveler.",
    effect: { type: "steal", amount: 15 },
  },
  whisper: {
    id: "whisper",
    name: "Barkeep's Whisper",
    rarity: "common",
    kind: "instant",
    needsTarget: false,
    needsText: true,
    description: "Send one anonymous message to the room.",
    effect: { type: "whisper" },
  },
  cursedDice: {
    id: "cursedDice",
    name: "Cursed Dice",
    rarity: "rare",
    kind: "trap",
    needsTarget: true,
    description: "Next round, your target gets 5 fewer seconds on every question.",
    effect: { type: "timePenalty", ms: 5000 },
  },
  luckyCoin: {
    id: "luckyCoin",
    name: "Lucky Coin",
    rarity: "rare",
    kind: "shield",
    needsTarget: false,
    description: "Blocks the first card played against you. Triggers on its own.",
    effect: { type: "shield" },
  },
};

export const HAND_LIMIT = 3;

// Rank prizes: 1st draws from rares, 2nd from commons. (Data, tune freely.)
const PRIZES_BY_RANK = { 1: "rare", 2: "common" };

export function createCardState(playerIds) {
  return {
    hands: Object.fromEntries(playerIds.map((id) => [id, []])),
    shields: {}, // playerId -> true while a Lucky Coin is armed
    traps: [], // effects waiting for the next round
  };
}

function randomCardOfRarity(rarity, rng) {
  const pool = Object.values(CARDS).filter((c) => c.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)].id;
}

// After a mini-game: hand out prizes by rank. Full hands get nothing.
// Returns { playerId: cardId } of what was awarded.
export function awardByRank(state, rankedPlayerIds, rng = Math.random) {
  const awarded = {};
  rankedPlayerIds.forEach((playerId, i) => {
    const rarity = PRIZES_BY_RANK[i + 1];
    if (!rarity) return;
    const hand = state.hands[playerId];
    if (!hand || hand.length >= HAND_LIMIT) return;
    const cardId = randomCardOfRarity(rarity, rng);
    hand.push(cardId);
    awarded[playerId] = cardId;
  });
  return awarded;
}

// Play a card. Returns what happened so the server can apply/announce it.
// A shielded target consumes the shield and blocks the whole card.
export function playCard(state, playerId, cardId, targetId = null) {
  const hand = state.hands[playerId];
  if (!hand?.includes(cardId)) return { ok: false, error: "You don't hold that card" };

  const card = CARDS[cardId];
  if (card.needsTarget && !targetId) return { ok: false, error: "Pick a target" };
  if (card.needsTarget && targetId === playerId) {
    return { ok: false, error: "Not on yourself" };
  }
  if (card.needsTarget && !(targetId in state.hands)) {
    return { ok: false, error: "No such traveler" };
  }

  hand.splice(hand.indexOf(cardId), 1); // the card is spent either way

  if (card.needsTarget && state.shields[targetId]) {
    delete state.shields[targetId];
    return { ok: true, card, targetId, blocked: true };
  }

  if (card.kind === "shield") {
    state.shields[playerId] = true;
    return { ok: true, card, shielded: true };
  }

  if (card.kind === "trap") {
    state.traps.push({ ...card.effect, targetId, cardId });
    return { ok: true, card, targetId, trapSet: true };
  }

  return { ok: true, card, targetId }; // instant — server applies the effect
}

// Round start: hand over the pending traps and clear the queue.
export function consumeTraps(state) {
  const traps = state.traps;
  state.traps = [];
  return traps;
}
