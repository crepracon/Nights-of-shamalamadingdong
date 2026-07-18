import { describe, it, expect } from "vitest";
import { smugglersBoxes as game } from "../src/games/smugglers-boxes.js";

// rng that always returns the same value — makes hider = first player
// and box inspection order deterministic enough for these tests.
const fixedRng = () => 0.01;

function makeGame() {
  // hider will be p1 (index 0 with fixedRng)
  return game.create(["p1", "p2", "p3"], fixedRng);
}

describe("the smuggler's boxes", () => {
  it("constrains hiding so the stash always fits the remaining boxes", () => {
    const state = makeGame();
    expect(state.hider).toBe("p1");

    // Hide 0 in boxes 1 and 2: 10 trinkets left, 3 boxes (max 12) — fine.
    expect(game.input(state, "p1", 0, 100).ok).toBe(true); // box1 = 0
    game.advance(state);
    expect(game.input(state, "p1", 0, 100).ok).toBe(true); // box2 = 0
    game.advance(state);

    // Box 3: 10 left, 2 boxes after can hold 8 -> minimum here is 2.
    const phase = game.phase(state);
    expect(game.personal(state, "p1").options[0]).toBe("2");

    // Non-hiders can't stash, and see no options.
    expect(game.input(state, "p2", 0, 100).ok).toBe(false);
    expect(phase.broadcast.options).toEqual([]);
  });

  it("silence auto-stashes minimums and auto-claims the truth", () => {
    const state = makeGame();
    for (let i = 0; i < 5; i++) game.advance(state); // hider says nothing
    // 5 boxes forced to legal minimums summing to the stash: 0,0,2,4,4
    expect(state.boxes.reduce((a, b) => a + b)).toBe(10);
    expect(state.step).toBe("claim");

    game.advance(state); // silent claim = the truth
    const box = state.inspect[0];
    expect(state.claims[0]).toBe(state.boxes[box]);
  });

  it("scores right guessers, hider scores nothing, walks to done", () => {
    const state = makeGame();
    // Hide: 2,2,2,2,2
    for (let i = 0; i < 5; i++) {
      const min = Number(game.personal(state, "p1").options[0]);
      game.input(state, "p1", 2 - min, 100);
      game.advance(state);
    }
    expect(state.boxes).toEqual([2, 2, 2, 2, 2]);

    for (let round = 0; round < 3; round++) {
      game.input(state, "p1", 4, 100); // always claim 4 (a lie)
      game.advance(state);
      game.input(state, "p2", 2, 1000); // p2 sees through it (truth is 2)
      game.input(state, "p3", 4, 500);  // p3 believes the lie
      expect(game.everyoneActed(state)).toBe(true);
      game.advance(state); // to reveal
      const reveal = game.phase(state);
      expect(reveal.kind).toBe("story");
      expect(reveal.broadcast.text).toContain("a LIE");
      game.advance(state);
    }

    expect(game.phase(state)).toBe(null);
    const ranked = game.results(state);
    expect(ranked[0].playerId).toBe("p2");
    expect(ranked[0].points).toBe(100);
    expect(ranked[0].label).toBe("3/3 seen through");
    expect(ranked[1].playerId).toBe("p3");
    expect(ranked[1].points).toBe(0); // zero right = zero points
    const hider = ranked.find((r) => r.playerId === "p1");
    expect(hider.points).toBe(0);
    expect(hider.label).toBe("ran the smuggle");
  });
});
