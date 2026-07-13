// server.js — the game server. Owns the ONE true game state (rule 3).
// Serves the client files with plain Node — no Express needed.

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
import { tavern } from "./src/content/tavern.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

// FAST_MODE=1 runs every clock at 10x speed — for testing only.
const SPEED = process.env.FAST_MODE === "1" ? 10 : 1;

const QUESTION_MS = 15000 / SPEED;  // answer each question
const RESULTS_HOLD_MS = 1500 / SPEED; // small beat before results land
const RESULTS_SHOW_MS = 8000 / SPEED; // scoreboard stays up this long
const GATHERING_MS = (5 * 60 * 1000) / SPEED; // table talk back at the inn (the big dial)

// Longer stories earn more reading time: ~350ms per word, clamped 15-60s.
function narrationTime(text) {
  const words = text.split(/\s+/).length;
  return Math.min(60000, Math.max(15000, words * 350)) / SPEED;
}

// Only these files are ever served.
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
let round = null;
let questionOpenedAt = null;
let phaseTimer = null;

function broadcastLobby() {
  io.emit("lobby", publicState(lobby));
}

function setPhaseTimer(ms, fn) {
  clearTimeout(phaseTimer);
  phaseTimer = setTimeout(fn, ms);
}

function startRound() {
  round = createRound(
    lobby.players.map((p) => p.id),
    tavern
  );
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
  const q = round.questions[round.currentQuestion];
  questionOpenedAt = Date.now();
  io.emit("phase", {
    name: "question",
    index: round.currentQuestion,
    total: round.questions.length,
    question: q.question,
    options: q.options, // correctAnswer stays server-side
    endsAt: questionOpenedAt + QUESTION_MS,
  });
  setPhaseTimer(QUESTION_MS, openNextQuestion);
}

function showResults() {
  clearTimeout(phaseTimer);
  const names = Object.fromEntries(lobby.players.map((p) => [p.id, p.name]));
  const ranked = results(round).map((r) => ({
    name: names[r.playerId] ?? "(left the inn)",
    correct: r.correct,
    of: round.questions.length,
    points: r.points,
    rank: r.rank,
  }));
  io.emit("phase", { name: "results", ranked });
  setPhaseTimer(RESULTS_SHOW_MS, startGathering);
}

// Back at the inn: candles relit, accusations fly, the clock runs.
function startGathering() {
  io.emit("phase", {
    name: "gathering",
    endsAt: Date.now() + GATHERING_MS,
  });
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
    broadcastLobby();
    setPhaseTimer(RESULTS_HOLD_MS, startRound);
  });

  socket.on("answer", ({ questionIndex, optionIndex }) => {
    if (!round) return;
    const timeMs = Date.now() - questionOpenedAt;
    const result = recordAnswer(
      round,
      socket.id,
      questionIndex,
      optionIndex,
      timeMs
    );
    if (result.ok) {
      socket.emit("answerLocked", { questionIndex });
      if (everyoneAnswered(round)) openNextQuestion(); // no waiting around
    }
  });

  // The innkeeper rings the bell: gathering ends now, next round begins.
  socket.on("ringBell", () => {
    const requester = lobby.players.find((p) => p.id === socket.id);
    if (!requester?.isHost || !lobby.started) return;
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
