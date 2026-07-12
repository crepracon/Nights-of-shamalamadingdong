// tavern.js — the Tavern location as DATA, not code.
// Adding stories, items, or patrons means editing this file only;
// the engine never changes.

export const tavern = {
  name: "The Rusty Horse Inn",

  template:
    "The Rusty Horse Inn winds down for the night. By the hearth, [patron] " +
    "in a [color] cloak nurses an ale, while [patron] argues loudly over dice. " +
    "The corner table holds [number] empty mugs, and the hound under it gnaws " +
    "on [object]. The waiter crosses the room carrying [item] — and drops " +
    "dead on the floor. The guard slams the door shut. \u201cNobody leaves!\u201d",

  wordLists: {
    patron: [
      "a one-eyed merchant",
      "a nervous stable hand",
      "an off-duty archer",
      "a snoring dwarf",
      "a suspiciously tall child",
      "a bard with a broken lute",
    ],
    color: ["green", "crimson", "mud-brown", "grey", "midnight-blue", "mustard"],
    number: ["two", "four", "six", "nine", "eleven"],
    item: [
      "a tray of honeyed bread",
      "a jug of spiced wine",
      "three empty tankards",
      "a steaming roast hen",
      "a bowl of questionable stew",
    ],
    object: [
      "a stolen boot",
      "an old ham bone",
      "someone's wig",
      "a wooden spoon",
      "a tax collector's ledger",
    ],
  },

  questionTexts: {
    patron: "Who was by the hearth?",
    color: "What color was the cloak by the hearth?",
    number: "How many empty mugs were on the corner table?",
    item: "What was the waiter carrying?",
    object: "What was the hound gnawing on?",
  },
};
