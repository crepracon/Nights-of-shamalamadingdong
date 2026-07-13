// tavern.js — the Tavern location as DATA, not code.
// Adding stories, items, or patrons means editing this file only;
// the engine never changes.
//
// Writing rule for templates: details should reference EACH OTHER —
// one scene where things happen to connected people, not a list of
// disconnected trivia. Questions for repeat tags (patron_2...) must say
// which one they mean.

export const tavern = {
  name: "The Rusty Horse Inn",

  template:
    "Rain hammers the shutters of the Rusty Horse Inn as the last candles " +
    "burn low. By the hearth, [patron] in a [color] cloak has been nursing " +
    "the same ale for an hour, watching the room over the rim of the mug. " +
    "At the long table, [patron] is losing badly at dice to [patron] — the " +
    "pot between them has grown to [number] coppers, and the loser keeps " +
    "muttering that the dice are cursed. The innkeep's old hound weaves " +
    "between the table legs, dragging [object] it stole from someone's pack. " +
    "The waiter sighs, steps over the hound, and carries [item] toward the " +
    "dice game to settle nerves — but never gets there. He staggers, drops " +
    "everything, and hits the floor. Dead. The guard at the door draws " +
    "steel and bars the way out. \u201cNobody leaves this room,\u201d he " +
    "growls. \u201cOne of you did this.\u201d",

  wordLists: {
    patron: [
      "a one-eyed merchant",
      "a nervous stable hand",
      "an off-duty archer",
      "a snoring dwarf",
      "a suspiciously tall child",
      "a bard with a broken lute",
      "a pale herbalist",
    ],
    color: ["green", "crimson", "mud-brown", "grey", "midnight-blue", "mustard"],
    number: ["twelve", "twenty", "thirty-one", "fifty", "sixty-six"],
    item: [
      "a tray of honeyed bread",
      "a jug of spiced wine",
      "two mugs of black stout",
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
    patron: "Who sat by the hearth, watching the room?",
    color: "What color was the cloak of the one by the hearth?",
    patron_2: "Who was LOSING at dice?",
    patron_3: "Who was WINNING at dice?",
    number: "How many coppers were in the dice pot?",
    object: "What was the hound dragging around?",
    item: "What was the waiter carrying when he fell?",
  },
};
