// round.js — one round of a mini-game, as a state machine.
//
// Phases: "narration" -> "question" (one per question) -> "results".
// The SERVER decides when to advance (its timers are the truth);
// this module just enforces what's legal in each phase.

import { fillTemplate } from "./template.js";
import { generateQuestions } from "./questions.js";
import { rankRound } from "./scoring.js";

// Build a fresh round from content (template + word lists + question texts).
export function createRound(playerIds, content, rng = Math.random) {
  const { text, picks } = fillTemplate(content.template, content.wordLists, rng);
  const questions = generateQuestions(
    picks,
    content.wordLists,
    content.questionTexts,
    rng
  );

  return {
    phase: "narration",
    narration: text,
    questions,
    currentQuestion: -1, // index into questions once phase is "question"
    // answers[playerId] = [{ optionIndex, timeMs }, ...] aligned to questions
    answers: Object.fromEntries(playerIds.map((id) => [id, []])),
  };
}

// Advance to the next phase. Returns the new phase name.
export function advance(round) {
  if (round.phase === "narration") {
    round.phase = "question";
    round.currentQuestion = 0;
  } else if (round.phase === "question") {
    if (round.currentQuestion < round.questions.length - 1) {
      round.currentQuestion += 1;
    } else {
      round.phase = "results";
    }
  }
  return round.phase;
}

// Record a player's answer to the CURRENT question.
// Late/duplicate/unknown answers are rejected, not errors — expected failures.
export function recordAnswer(round, playerId, questionIndex, optionIndex, timeMs) {
  if (round.phase !== "question") return { ok: false, error: "No question is open" };
  if (questionIndex !== round.currentQuestion) {
    return { ok: false, error: "That question is closed" };
  }
  if (!(playerId in round.answers)) return { ok: false, error: "Unknown player" };
  if (round.answers[playerId][questionIndex] !== undefined) {
    return { ok: false, error: "Already answered" };
  }

  round.answers[playerId][questionIndex] = { optionIndex, timeMs };
  return { ok: true };
}

// True when every player has answered the current question (lets the
// server skip ahead instead of waiting out the clock).
export function everyoneAnswered(round) {
  if (round.phase !== "question") return false;
  return Object.values(round.answers).every(
    (list) => list[round.currentQuestion] !== undefined
  );
}

// Tally the round: per-player correct counts + total time, ranked.
export function results(round) {
  const tallies = Object.entries(round.answers).map(([playerId, list]) => {
    let correct = 0;
    let totalTimeMs = 0;
    round.questions.forEach((q, i) => {
      const answer = list[i];
      if (!answer) return; // never answered — counts as wrong, no time
      totalTimeMs += answer.timeMs;
      if (q.options[answer.optionIndex] === q.correctAnswer) correct += 1;
    });
    return { playerId, correct, totalTimeMs };
  });

  return rankRound(tallies);
}
