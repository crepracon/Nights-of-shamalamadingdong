import { describe, it, expect } from "vitest";
import {
  createRound,
  advance,
  recordAnswer,
  everyoneAnswered,
  results,
} from "../src/round.js";
import { tavern } from "../src/content/tavern.js";

function freshRound() {
  return createRound(["p1", "p2"], tavern, Math.random);
}

describe("round", () => {
  it("walks narration -> each question -> results", () => {
    const round = freshRound();
    expect(round.phase).toBe("narration");
    expect(round.narration).toContain("Rusty Horse Inn");

    advance(round);
    expect(round.phase).toBe("question");
    expect(round.currentQuestion).toBe(0);

    for (let i = 1; i < round.questions.length; i++) {
      advance(round);
      expect(round.currentQuestion).toBe(i);
    }
    advance(round);
    expect(round.phase).toBe("results");
  });

  it("rejects answers outside the open question, accepts one per player", () => {
    const round = freshRound();
    expect(recordAnswer(round, "p1", 0, 1, 900).ok).toBe(false); // still narration

    advance(round); // question 0 open
    expect(recordAnswer(round, "p1", 0, 1, 900).ok).toBe(true);
    expect(recordAnswer(round, "p1", 0, 2, 950).ok).toBe(false); // no changing answers
    expect(recordAnswer(round, "p2", 1, 0, 500).ok).toBe(false); // question 1 not open

    expect(everyoneAnswered(round)).toBe(false);
    expect(recordAnswer(round, "p2", 0, 0, 500).ok).toBe(true);
    expect(everyoneAnswered(round)).toBe(true);
  });

  it("scores correct answers and ranks players", () => {
    const round = freshRound();
    advance(round);

    // p1 answers every question correctly (we look up the right option),
    // p2 always picks a wrong one.
    for (let i = 0; i < round.questions.length; i++) {
      const q = round.questions[i];
      const rightIndex = q.options.indexOf(q.correctAnswer);
      const wrongIndex = (rightIndex + 1) % q.options.length;
      recordAnswer(round, "p1", i, rightIndex, 1000);
      recordAnswer(round, "p2", i, wrongIndex, 800);
      advance(round);
    }

    expect(round.phase).toBe("results");
    const ranked = results(round);
    expect(ranked[0].playerId).toBe("p1");
    expect(ranked[0].correct).toBe(round.questions.length);
    expect(ranked[0].points).toBe(100);
    expect(ranked[1].playerId).toBe("p2");
    expect(ranked[1].correct).toBe(0);
    expect(ranked[1].points).toBe(0);
  });
});
