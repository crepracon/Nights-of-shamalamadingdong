import { describe, it, expect } from "vitest";
import { rankRound } from "../src/scoring.js";

describe("rankRound", () => {
  it("ranks by correct answers, breaks ties by speed", () => {
    const ranked = rankRound([
      { playerId: "slow-sage", correct: 3, totalTimeMs: 20000 },
      { playerId: "quick-quill", correct: 3, totalTimeMs: 12000 },
      { playerId: "dozy-dwarf", correct: 1, totalTimeMs: 5000 },
    ]);
    expect(ranked.map((r) => r.playerId)).toEqual([
      "quick-quill",
      "slow-sage",
      "dozy-dwarf",
    ]);
    expect(ranked[0].points).toBe(100);
    expect(ranked[1].points).toBe(80);
    expect(ranked[2].points).toBe(60);
  });

  it("gives zero points for zero correct answers, even if fast", () => {
    const ranked = rankRound([
      { playerId: "sharp", correct: 2, totalTimeMs: 30000 },
      { playerId: "hasty", correct: 0, totalTimeMs: 1000 },
    ]);
    const hasty = ranked.find((r) => r.playerId === "hasty");
    expect(hasty.points).toBe(0);
    expect(hasty.rank).toBe(2);
  });
});
