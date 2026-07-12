import { describe, it, expect } from "vitest";
import { generateQuestions } from "../src/questions.js";

const wordLists = {
  item: ["honeyed bread", "spiced wine", "empty tankards", "a roast hen"],
  color: ["green", "crimson", "mud-brown", "grey"],
};

const questionTexts = {
  item: "What was the waiter carrying?",
  color: "What color was the patron's cloak?",
};

describe("generateQuestions", () => {
  it("builds a 4-option question containing the correct answer", () => {
    const qs = generateQuestions(
      { item: "spiced wine" },
      wordLists,
      questionTexts
    );
    expect(qs).toHaveLength(1);
    expect(qs[0].question).toBe("What was the waiter carrying?");
    expect(qs[0].options).toHaveLength(4);
    expect(qs[0].options).toContain("spiced wine");
    expect(qs[0].correctAnswer).toBe("spiced wine");
    // no duplicate options
    expect(new Set(qs[0].options).size).toBe(4);
  });

  it("skips tags without a pick and repeat picks (tag_2)", () => {
    const qs = generateQuestions(
      { color: "green", color_2: "crimson" },
      wordLists,
      questionTexts
    );
    expect(qs).toHaveLength(1); // only the first color, no item question
    expect(qs[0].tag).toBe("color");
    expect(qs[0].correctAnswer).toBe("green");
  });

  it("throws a clear error when a word list is too small for 4 options", () => {
    expect(() =>
      generateQuestions(
        { item: "ale" },
        { item: ["ale", "bread"] },
        { item: "What was carried?" }
      )
    ).toThrow("at least 4 entries");
  });
});
