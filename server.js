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

const NARRATION_MS = 20000; // read the story
const QUESTION_MS = 15000;  // answer each question
const RESULTS_HOLD_MS = 1500; // small beat before results land

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
  io.emit("phase", {
    name: "narration",
    narration: round.narration,
    endsAt: Date.now() + NARRATION_MS,
  });
  setPhaseTimer(NARRATION_MS, openNextQuestion);
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

  // Host can run another round with the same crowd (great for testing).
  socket.on("playAgain", () => {
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
