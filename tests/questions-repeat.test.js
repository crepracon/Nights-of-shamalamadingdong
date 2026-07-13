import { describe, it, expect } from "vitest";
import { generateQuestions } from "../src/questions.js";

describe("generateQuestions with repeat picks", () => {
  it("asks about patron_2 using the base patron word list for wrong answers", () => {
    const wordLists = {
      patron: ["a merchant", "a dwarf", "an archer", "a bard", "a herbalist"],
    };
    const qs = generateQuestions(
      { patron: "a merchant", patron_2: "a dwarf" },
      wordLists,
      { patron_2: "Who was losing at dice?" }
    );
    expect(qs).toHaveLength(1);
    expect(qs[0].correctAnswer).toBe("a dwarf");
    expect(qs[0].options).toContain("a dwarf");
    expect(qs[0].options).toHaveLength(4);
    // every option comes from the patron list
    for (const option of qs[0].options) {
      expect(wordLists.patron).toContain(option);
    }
  });
});
