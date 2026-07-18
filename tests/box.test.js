import { describe, it, expect } from "vitest";
import { createBox, drawGame } from "../src/box.js";
import { lastOrders } from "../src/games/last-orders.js";

describe("the box", () => {
  it("avoids repeating the last game when it has a choice", () => {
    const gameA = { id: "a" };
    const gameB = { id: "b" };
    const box = createBox([gameA, gameB]);
    for (let i = 0; i < 20; i++) {
      expect(drawGame(box, "a").id).toBe("b");
      expect(drawGame(box, "b").id).toBe("a");
    }
  });

  it("allows repeats when there's only one game", () => {
    const box = createBox([{ id: "solo" }]);
    expect(drawGame(box, "solo").id).toBe("solo");
  });
});

describe("last orders via the box interface", () => {
  it("walks story -> choices phases -> null, and scores through the interface", () => {
    const state = lastOrders.create(["p1", "p2"]);

    const story = lastOrders.phase(state);
    expect(story.kind).toBe("story");
    expect(story.broadcast.text).toContain("Rusty Horse Inn");
    expect(story.durationMs).toBeGreaterThanOrEqual(15000);

    lastOrders.advance(state);
    let phase = lastOrders.phase(state);
    let asked = 0;
    while (phase) {
      expect(phase.kind).toBe("choices");
      expect(phase.acceptsInput).toBe(true);
      // p1 answers correctly, p2 wrongly
      const q = state.questions[state.currentQuestion];
      const right = q.options.indexOf(q.correctAnswer);
      expect(lastOrders.input(state, "p1", right, 1000).ok).toBe(true);
      expect(lastOrders.everyoneActed(state)).toBe(false);
      expect(lastOrders.input(state, "p2", (right + 1) % 4, 500).ok).toBe(true);
      expect(lastOrders.everyoneActed(state)).toBe(true);
      asked++;
      lastOrders.advance(state);
      phase = lastOrders.phase(state);
    }

    expect(asked).toBe(state.questions.length);
    const ranked = lastOrders.results(state);
    expect(ranked[0].playerId).toBe("p1");
    expect(ranked[0].label).toMatch(/correct/);
    expect(ranked[0].points).toBe(100);
  });
});
