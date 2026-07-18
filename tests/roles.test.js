import { describe, it, expect } from "vitest";
import {
  assignRoles,
  knownTo,
  rosterFor,
  playersWithRole,
  ROLES,
} from "../src/roles.js";

// A predictable "random" so the deal is the same every run.
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("roster", () => {
  it("adds roles as the table fills up", () => {
    expect(rosterFor(2)).toEqual(["culprit"]);
    expect(rosterFor(3)).toEqual(["culprit", "sheriff"]);
    expect(rosterFor(4)).toEqual(["culprit", "sheriff"]);
    expect(rosterFor(5)).toEqual(["culprit", "sheriff", "guard"]);
    expect(rosterFor(9)).toEqual(["culprit", "sheriff", "guard"]);
  });
});

describe("assignRoles", () => {
  it("deals exactly one culprit and fills the rest with villagers", () => {
    const byPlayer = assignRoles(["a", "b", "c", "d"], seq(0));
    expect(Object.keys(byPlayer)).toHaveLength(4);
    expect(playersWithRole(byPlayer, "culprit")).toHaveLength(1);
    expect(playersWithRole(byPlayer, "sheriff")).toHaveLength(1);
    expect(playersWithRole(byPlayer, "guard")).toHaveLength(0);
    expect(playersWithRole(byPlayer, "villager")).toHaveLength(2);
  });

  it("seats a guard once five travelers are at the table", () => {
    const byPlayer = assignRoles(["a", "b", "c", "d", "e"], seq(0.5));
    expect(playersWithRole(byPlayer, "guard")).toHaveLength(1);
    expect(playersWithRole(byPlayer, "villager")).toHaveLength(2);
  });

  it("gives every player exactly one known role", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const byPlayer = assignRoles(ids, seq(0.1, 0.7, 0.3));
    for (const id of ids) {
      expect(ROLES[byPlayer[id]]).toBeDefined();
    }
  });

  it("does not always hand the culprit to the same seat", () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const byPlayer = assignRoles(["a", "b", "c"]);
      seen.add(playersWithRole(byPlayer, "culprit")[0]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("refuses to deal to an empty table", () => {
    expect(() => assignRoles([])).toThrow();
  });
});

describe("knownTo", () => {
  it("tells you your own role and never anyone else's", () => {
    const byPlayer = { a: "culprit", b: "sheriff", c: "villager" };

    const view = knownTo(byPlayer, "a");
    expect(view.id).toBe("culprit");

    // The whole point: no player ids anywhere in what a player receives.
    // Role NAMES are fine — the counts below are public knowledge.
    const serialized = JSON.stringify(view);
    for (const id of Object.keys(byPlayer)) {
      expect(serialized).not.toContain(`"${id}"`);
    }
  });

  it("shares the table's composition without saying who is who", () => {
    const byPlayer = { a: "culprit", b: "sheriff", c: "villager", d: "villager" };
    expect(knownTo(byPlayer, "c").table).toEqual([
      { id: "culprit", name: "The Culprit", count: 1 },
      { id: "sheriff", name: "The Sheriff", count: 1 },
      { id: "villager", name: "Traveler", count: 2 },
    ]);
  });

  it("returns nothing for someone not at the table", () => {
    expect(knownTo({ a: "culprit" }, "zz")).toBeNull();
  });
});
