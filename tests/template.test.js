import { describe, it, expect } from "vitest";
import { fillTemplate } from "../src/template.js";

describe("fillTemplate", () => {
  it("fills a tag and records the pick (narration matches answer key)", () => {
    const { text, picks } = fillTemplate(
      "The waiter carried [item].",
      { item: ["honeyed bread"] }
    );
    expect(text).toBe("The waiter carried honeyed bread.");
    expect(picks.item).toBe("honeyed bread");
  });

  it("gives repeated tags different words and numbers the picks", () => {
    const { text, picks } = fillTemplate(
      "One patron wore a [color] cloak, another a [color] cloak.",
      { color: ["green", "red"] }
    );
    expect(picks.color).not.toBe(picks.color_2);
    expect(text).toContain(picks.color);
    expect(text).toContain(picks.color_2);
  });

  it("throws a clear error for a missing word list", () => {
    expect(() => fillTemplate("A [ghost] appears", {})).toThrow(
      "No word list for tag [ghost]"
    );
  });
});
