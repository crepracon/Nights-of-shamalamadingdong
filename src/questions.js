// questions.js — turns a round's answer key into multiple-choice questions.
//
// Input:
//   picks         — the answer key from fillTemplate, e.g. { item: "spiced wine", color: "green" }
//   wordLists     — the same lists used to fill the template (wrong answers come from here,
//                   so they're always plausible)
//   questionTexts — one question per tag, e.g. { item: "What was the waiter carrying?" }
//
// Output: an array of
//   { tag, question, options: [4 shuffled choices], correctAnswer }
//
// Rules:
//   - Only tags that have a question text get asked.
//   - If a tag was picked more than once (patron, patron_2...), only the FIRST
//     pick is asked about — repeat picks would make questions ambiguous.
//   - Each question gets 4 options: the right answer + 3 wrong ones drawn
//     from the same word list, shuffled.

export function generateQuestions(picks, wordLists, questionTexts, rng = Math.random) {
  const questions = [];

  for (const [tag, questionText] of Object.entries(questionTexts)) {
    const correctAnswer = picks[tag]; // numbered keys (tag_2...) are skipped on purpose
    if (correctAnswer === undefined) continue;

    const list = wordLists[tag] || [];
    const distractors = shuffle(
      list.filter((w) => w !== correctAnswer),
      rng
    ).slice(0, 3);

    if (distractors.length < 3) {
      throw new Error(
        `Word list for [${tag}] needs at least 4 entries to build a question`
      );
    }

    questions.push({
      tag,
      question: questionText,
      options: shuffle([correctAnswer, ...distractors], rng),
      correctAnswer,
    });
  }

  return questions;
}

function shuffle(array, rng) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
