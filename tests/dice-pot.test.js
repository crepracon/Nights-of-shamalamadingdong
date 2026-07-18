import { describe, it, expect } from "vitest";
import { dicePot } from "../src/games/dice-pot.js";

// Rigged dice: feed exact die faces (1-6); each roll consumes two.
function riggedRng(faces) {
  const queue = [...faces];
  return () => (queue.shift() - 1) / 6 + 0.001;
}

describe("the dice pot", () => {
  it("banks strictly-higher rerolls and busts ties and lower rolls", () => {
    // First rolls: p1 gets 3+4=7, p2 gets 2+2=4
    // Round 1 rerolls: p1 rolls 5+4=9 (>7, banks), p2 rolls 1+3=4 (tie, BUST)
    const state = dicePot.create(
      ["p1", "p2"],
      riggedRng([3, 4, 2, 2, 5, 4, 1, 3])
    );
    expect(state.players.p1.score).toBe(7);
    expect(state.players.p2.score).toBe(4);

    expect(dicePot.input(state, "p1", 0).ok).toBe(true); // roll
    expect(dicePot.input(state, "p2", 0).ok).toBe(true); // roll
    expect(dicePot.everyoneActed(state)).toBe(true);
    dicePot.advance(state);

    expect(state.players.p1.score).toBe(16); // 7 + 9
    expect(state.players.p1.lastRoll).toBe(9);
    expect(state.players.p2.status).toBe("bust");
    expect(state.players.p2.score).toBe(0); // lose everything
  });

  it("standing banks your score; silence counts as standing; game ends", () => {
    const state = dicePot.create(["p1", "p2"], riggedRng([3, 3, 4, 4]));
    dicePot.input(state, "p1", 1); // stand
    // p2 never decides — the clock runs out
    dicePot.advance(state);

    expect(state.players.p1.status).toBe("stood");
    expect(state.players.p2.status).toBe("stood");
    expect(state.done).toBe(true);
    expect(dicePot.phase(state)).toBe(null);
  });

  it("busted players can't act, and results rank banked scores with busts at zero", () => {
    const state = dicePot.create(
      ["p1", "p2", "p3"],
      // initial: p1 3+4=7, p2 2+2=4, p3 1+1=2
      // round 1: p1 rolls 6+6=12 (>7, banks 19), p2 rolls 2+2=4 (tie, BUST)
      riggedRng([3, 4, 2, 2, 1, 1, 6, 6, 2, 2])
    );
    // p1: 7 rolls 12 -> 19. p2: 4 ties 4 -> bust. p3: 2, stands.
    dicePot.input(state, "p1", 0);
    dicePot.input(state, "p2", 0);
    dicePot.input(state, "p3", 1);
    dicePot.advance(state);

    expect(dicePot.input(state, "p2", 0).ok).toBe(false); // busted = out

    dicePot.input(state, "p1", 1); // stand at 19
    dicePot.advance(state);

    const ranked = dicePot.results(state);
    expect(ranked.map((r) => r.playerId)).toEqual(["p1", "p3", "p2"]);
    expect(ranked[0].label).toBe("banked 19");
    expect(ranked[0].points).toBe(100);
    expect(ranked[2].label).toBe("went bust");
    expect(ranked[2].points).toBe(0);
  });
});
