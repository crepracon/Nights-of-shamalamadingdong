import { describe, it, expect } from "vitest";
import {
  createStandings,
  applyRoundPoints,
  transferPoints,
  spendPoints,
} from "../src/scores.js";
import {
  createCardState,
  awardByRank,
  playCard,
  consumeTraps,
  CARDS,
  HAND_LIMIT,
} from "../src/cards.js";

describe("standings", () => {
  it("accumulates points across rounds and transfers safely", () => {
    const s = createStandings();
    applyRoundPoints(s, [
      { playerId: "p1", points: 100 },
      { playerId: "p2", points: 60 },
    ]);
    applyRoundPoints(s, [
      { playerId: "p1", points: 40 },
      { playerId: "p2", points: 100 },
    ]);
    expect(s.p1).toBe(140);
    expect(s.p2).toBe(160);

    // steal 15 works; stealing from a pauper takes only what exists
    expect(transferPoints(s, "p2", "p1", 15)).toBe(15);
    s.p2 = 5;
    expect(transferPoints(s, "p2", "p1", 15)).toBe(5);
    expect(s.p2).toBe(0);
  });

  it("refuses spending points you don't have", () => {
    const s = createStandings();
    applyRoundPoints(s, [{ playerId: "p1", points: 30 }]);
    expect(spendPoints(s, "p1", 50).ok).toBe(false);
    expect(spendPoints(s, "p1", 30).ok).toBe(true);
    expect(s.p1).toBe(0);
  });
});

describe("cards", () => {
  it("awards rank prizes: 1st a rare, 2nd a common, full hands skipped", () => {
    const state = createCardState(["p1", "p2", "p3"]);
    state.hands.p2 = ["whisper", "whisper", "whisper"]; // full
    const awarded = awardByRank(state, ["p1", "p2", "p3"]);

    expect(CARDS[awarded.p1].rarity).toBe("rare");
    expect(awarded.p2).toBeUndefined(); // hand full
    expect(awarded.p3).toBeUndefined(); // 3rd place: no prize
    expect(state.hands.p2).toHaveLength(HAND_LIMIT);
  });

  it("plays instants, sets traps, and consumes them at round start", () => {
    const state = createCardState(["p1", "p2"]);
    state.hands.p1 = ["pickpocket", "cursedDice"];

    const steal = playCard(state, "p1", "pickpocket", "p2");
    expect(steal.ok).toBe(true);
    expect(steal.card.effect.type).toBe("steal");

    const trap = playCard(state, "p1", "cursedDice", "p2");
    expect(trap.trapSet).toBe(true);
    expect(consumeTraps(state)).toEqual([
      { type: "timePenalty", ms: 5000, targetId: "p2", cardId: "cursedDice" },
    ]);
    expect(consumeTraps(state)).toEqual([]); // queue cleared
    expect(state.hands.p1).toHaveLength(0); // both cards spent
  });

  it("a Lucky Coin blocks one hostile card, then is gone", () => {
    const state = createCardState(["p1", "p2"]);
    state.hands.p1 = ["luckyCoin"];
    state.hands.p2 = ["pickpocket", "pickpocket"];

    expect(playCard(state, "p1", "luckyCoin").shielded).toBe(true);

    const first = playCard(state, "p2", "pickpocket", "p1");
    expect(first.blocked).toBe(true); // shield eats it (card still spent)

    const second = playCard(state, "p2", "pickpocket", "p1");
    expect(second.blocked).toBeUndefined(); // shield is gone
  });

  it("rejects playing cards you don't hold or targeting yourself", () => {
    const state = createCardState(["p1", "p2"]);
    state.hands.p1 = ["pickpocket"];
    expect(playCard(state, "p1", "cursedDice", "p2").ok).toBe(false);
    expect(playCard(state, "p1", "pickpocket", "p1").ok).toBe(false);
  });
});
