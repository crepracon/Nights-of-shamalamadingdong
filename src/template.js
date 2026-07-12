// template.js — fills [tag] placeholders in story text from word lists.
//
// Core idea: the SAME picks that build the narration also become the
// quiz answer key. One source of truth: narration and answers can
// never disagree.
//
// fillTemplate("The waiter carried [item]", { item: ["ale", "bread"] })
//   -> { text: "The waiter carried bread", picks: { item: "bread" } }
//
// If the same tag appears twice, each use gets a DIFFERENT word
// (so two patrons never wear the same cloak). Picks are then stored
// as item, item_2, item_3...

export function fillTemplate(template, wordLists, rng = Math.random) {
  const picks = {};
  const used = {}; // words already used per tag, to avoid repeats

  const text = template.replace(/\[([a-z_]+)\]/g, (match, tag) => {
    const list = wordLists[tag];
    if (!list || list.length === 0) {
      throw new Error(`No word list for tag [${tag}]`);
    }

    const available = list.filter((w) => !(used[tag] || []).includes(w));
    if (available.length === 0) {
      throw new Error(`Word list for [${tag}] ran out of unique words`);
    }

    const word = available[Math.floor(rng() * available.length)];
    used[tag] = [...(used[tag] || []), word];

    // First use stored as "item", later uses as "item_2", "item_3"...
    const count = used[tag].length;
    const key = count === 1 ? tag : `${tag}_${count}`;
    picks[key] = word;

    return word;
  });

  return { text, picks };
}
