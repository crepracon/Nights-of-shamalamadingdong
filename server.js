// server.js — the game server. Owns the ONE true game state (rule 3).

import http from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import {
  createLobby,
  addPlayer,
  removePlayer,
  startGame,
  publicState,
} from "./src/lobby.js";
import {
  createRound,
  advance,
  recordAnswer,
  everyoneAnswered,
  results,
} from "./src/round.js";
import {
  createStandings,
  applyRoundPoints,
  transferPoints,
  total,
} from "./src/scores.js";
import { createCardState, awardByRank, playCard, consumeTraps, CARDS } from "./src/cards.js";
import { tavern } from "./src/content/tavern.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

// FAST_MODE=1 runs every clock at 10x speed — for testing only.
const SPEED = process.env.FAST_MODE === "1" ? 10 : 1;

const QUESTION_MS = 15000 / SPEED;
const RESULTS_HOLD_MS = 1500 / SPEED;
const RESULTS_SHOW_MS = 8000 / SPEED;
const GATHERING_MS = (5 * 60 * 1000) / SPEED; // the big dial

// Longer stories earn more reading time: ~350ms per word, clamped 15-60s.
function narrationTime(text) {
  const words = text.split(/\s+/).length;
  return Math.min(60000, Math.max(15000, words * 350)) / SPEED;
}

const FILES = {
  "/": ["index.html", "text/html"],
  "/client.js": ["client.js", "text/javascript"],
  "/style.css": ["style.css", "text/css"],
};

const httpServer = http.createServer(async (req, res) => {
  const entry = FILES[req.url];
  if (!entry) {
    res.writeHead(404).end("Not found");
    return;
  }
  const [file, type] = entry;
  res.writeHead(200, { "Content-Type": type });
  res.end(await readFile(path.join(PUBLIC_DIR, file)));
});

const io = new Server(httpServer);

// ---- The single source of truth ----
const lobby = createLobby();
const standings = createStandings();
let cardState = null;
let round = null;
let phaseName = "lobby";
let questionOpenedAt = null;
let phaseTimer = null;
let roundPenalties = {}; // playerId -> ms lost per question (Cursed Dice)

function broadcastLobby() {
  io.emit("lobby", publicState(lobby));
}

function setPhaseTimer(ms, fn) {
  clearTimeout(phaseTimer);
  phaseTimer = setTimeout(fn, ms);
}

function nameOf(playerId) {
  return lobby.players.find((p) => p.id === playerId)?.name ?? "someone";
}

function sendHand(playerId) {
  const socket = io.sockets.sockets.get(playerId);
  if (!socket) return;
  const hand = (cardState?.hands[playerId] ?? []).map((cardId) => CARDS[cardId]);
  socket.emit("hand", hand);
}

function feed(message) {
  io.emit("tavernFeed", message);
}

function startRound() {
  // Spring the traps set during the gathering.
  roundPenalties = {};
  for (const trap of consumeTraps(cardState)) {
    if (trap.type === "timePenalty") {
      roundPenalties[trap.targetId] =
        (roundPenalties[trap.targetId] ?? 0) + trap.ms / SPEED;
    }
  }

  round = createRound(
    lobby.players.map((p) => p.id),
    tavern
  );
  phaseName = "narration";
  const readingMs = narrationTime(round.narration);
  io.emit("phase", {
    name: "narration",
    narration: round.narration,
    endsAt: Date.now() + readingMs,
  });
  setPhaseTimer(readingMs, openNextQuestion);
}

function openNextQuestion() {
  advance(round);
  if (round.phase === "results") {
    showResults();
    return;
  }
  phaseName = "question";
  const q = round.questions[round.currentQuestion];
  questionOpenedAt = Date.now();

  // Cursed players get a personally shorter clock.
  for (const player of lobby.players) {
    const socket = io.sockets.sockets.get(player.id);
    if (!socket) continue;
    const penalty = roundPenalties[player.id] ?? 0;
    socket.emit("phase", {
      name: "question",
      index: round.currentQuestion,
      total: round.questions.length,
      question: q.question,
      options: q.options, // correctAnswer stays server-side
      endsAt: questionOpenedAt + QUESTION_MS - penalty,
      cursed: penalty > 0,
    });
  }
  setPhaseTimer(QUESTION_MS, openNextQuestion);
}

function showResults() {
  clearTimeout(phaseTimer);
  phaseName = "results";
  const ranked = results(round);
  applyRoundPoints(standings, ranked);

  // Rank prizes: winner draws a rare, runner-up a common.
  const awarded = awardByRank(
    cardState,
    ranked.map((r) => r.playerId)
  );
  for (const [playerId, cardId] of Object.entries(awarded)) {
    const socket = io.sockets.sockets.get(playerId);
    socket?.emit("cardAwarded", CARDS[cardId]);
    sendHand(playerId);
  }

  io.emit("phase", {
    name: "results",
    ranked: ranked.map((r) => ({
      name: nameOf(r.playerId),
      correct: r.correct,
      of: round.questions.length,
      points: r.points,
      totalPoints: total(standings, r.playerId),
      rank: r.rank,
    })),
  });
  setPhaseTimer(RESULTS_SHOW_MS, startGathering);
}

// Back at the inn: candles relit, accusations and cards fly.
function startGathering() {
  phaseName = "gathering";
  io.emit("phase", {
    name: "gathering",
    endsAt: Date.now() + GATHERING_MS,
  });
  for (const player of lobby.players) sendHand(player.id);
  setPhaseTimer(GATHERING_MS, startRound);
}

io.on("connection", (socket) => {
  socket.on("join", (name) => {
    const result = addPlayer(lobby, socket.id, name);
    if (!result.ok) {
      socket.emit("joinError", result.error);
      return;
    }
    socket.emit("joined", { name: String(name).trim() });
    broadcastLobby();
  });

  socket.on("start", () => {
    const result = startGame(lobby, socket.id);
    if (!result.ok) {
      socket.emit("error_message", result.error);
      return;
    }
    cardState = createCardState(lobby.players.map((p) => p.id));
    broadcastLobby();
    setPhaseTimer(RESULTS_HOLD_MS, startRound);
  });

  socket.on("answer", ({ questionIndex, optionIndex }) => {
    if (!round) return;
    const timeMs = Date.now() - questionOpenedAt;
    const allowed = QUESTION_MS - (roundPenalties[socket.id] ?? 0);
    if (timeMs > allowed) return; // the cursed clock has run out — expected failure
    const result = recordAnswer(round, socket.id, questionIndex, optionIndex, timeMs);
    if (result.ok) {
      socket.emit("answerLocked", { questionIndex });
      if (everyoneAnswered(round)) openNextQuestion();
    }
  });

  socket.on("playCard", ({ cardId, targetName, text }) => {
    if (phaseName !== "gathering" || !cardState) {
      socket.emit("error_message", "Cards can only be played back at the inn");
      return;
    }
    const targetId = targetName
      ? lobby.players.find((p) => p.name === targetName)?.id ?? null
      : null;

    const result = playCard(cardState, socket.id, cardId, targetId);
    if (!result.ok) {
      socket.emit("error_message", result.error);
      return;
    }
    sendHand(socket.id);

    if (result.blocked) {
      feed(`Someone tried something on ${nameOf(targetId)}… but a lucky coin flashed. Blocked.`);
      return;
    }
    if (result.shielded) {
      socket.emit("privateNote", "You palm the lucky coin. It will block the next card played on you.");
      return;
    }
    if (result.trapSet) {
      socket.emit("privateNote", "Your trap is set. It springs next round.");
      return;
    }
    // Instants
    if (result.card.effect.type === "steal") {
      const taken = transferPoints(standings, targetId, socket.id, result.card.effect.amount);
      feed(`A pickpocket brushes past ${nameOf(targetId)} — ${taken} points lighter.`);
    }
    if (result.card.effect.type === "whisper") {
      const note = String(text ?? "").slice(0, 120).trim();
      if (note) feed(`The barkeep passes a note: “${note}”`);
    }
  });

  // The innkeeper rings the bell: gathering ends now, next round begins.
  socket.on("ringBell", () => {
    const requester = lobby.players.find((p) => p.id === socket.id);
    if (!requester?.isHost || !lobby.started || phaseName !== "gathering") return;
    startRound();
  });

  socket.on("disconnect", () => {
    removePlayer(lobby, socket.id);
    broadcastLobby();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Nights of Shabalabadingdong server on http://localhost:${PORT}`);
});
