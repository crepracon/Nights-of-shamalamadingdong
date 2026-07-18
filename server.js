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
  reconnect,
  markDisconnected,
  playerBySocket,
  playerByPid,
  startGame,
  publicState,
} from "./src/lobby.js";
import { createBox, drawGame } from "./src/box.js";
import { lastOrders } from "./src/games/last-orders.js";
import { dicePot } from "./src/games/dice-pot.js";
import { smugglersBoxes } from "./src/games/smugglers-boxes.js";
import {
  createStandings,
  applyRoundPoints,
  transferPoints,
  total,
} from "./src/scores.js";
import { createCardState, awardByRank, playCard, consumeTraps, CARDS } from "./src/cards.js";
import { assignRoles, knownTo } from "./src/roles.js";

const box = createBox([lastOrders, dicePot, smugglersBoxes]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

// FAST_MODE=1 runs every clock at 10x speed — for testing only.
const SPEED = process.env.FAST_MODE === "1" ? 10 : 1;

const RESULTS_HOLD_MS = 1500 / SPEED;
const ROLE_REVEAL_MS = 12000 / SPEED; // wheel spin + time to read your fate
const RESULTS_SHOW_MS = 8000 / SPEED;
const GATHERING_MS = (5 * 60 * 1000) / SPEED; // the big dial
// How long a dropped player keeps their lobby seat before we free it. Long
// enough to cover a refresh; only applies BEFORE the game starts.
const DISCONNECT_GRACE_MS = 30000 / SPEED;

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
// Everything below is keyed by the player's STABLE pid, never the socket id.
const lobby = createLobby();
const standings = createStandings();
let cardState = null;
let roles = null; // pid -> roleId. PRIVATE. Never broadcast whole.
let game = null; // the mini-game drawn from the box
let gameState = null;
let lastGameId = null;
let currentPhase = null; // the game's current phase descriptor
let phaseName = "lobby";
let phaseOpenedAt = null;
let phaseEndsAt = null; // when the current phase's clock runs out (for resends)
let phaseTimer = null;
let roundPenalties = {}; // pid -> ms lost per question (Cursed Dice)
let lastResultsPayload = null; // stashed so a reconnector can see the scoreboard
const graceTimers = {}; // pid -> pending seat-cleanup timer

function broadcastLobby() {
  io.emit("lobby", publicState(lobby));
}

function setPhaseTimer(ms, fn) {
  clearTimeout(phaseTimer);
  phaseTimer = setTimeout(fn, ms);
}

// pid <-> socket translation. Game state keys on the stable pid; a socket is
// just the current address for reaching that pid.
function pidOf(socket) {
  return playerBySocket(lobby, socket.id)?.pid ?? null;
}
function socketForPid(pid) {
  const player = playerByPid(lobby, pid);
  return player ? io.sockets.sockets.get(player.socketId) ?? null : null;
}
function nameOf(pid) {
  return playerByPid(lobby, pid)?.name ?? "someone";
}
function playerByName(name) {
  return lobby.players.find((p) => p.name === name) ?? null;
}

function sendHand(pid) {
  const socket = socketForPid(pid);
  if (!socket) return;
  const hand = (cardState?.hands[pid] ?? []).map((cardId) => CARDS[cardId]);
  socket.emit("hand", hand);
}

function feed(message) {
  io.emit("tavernFeed", message);
}

// The wheel spins once a night. Each player watches it land on their own
// secret — same spin, different fate.
function startRoleReveal() {
  phaseName = "roleReveal";
  phaseEndsAt = Date.now() + ROLE_REVEAL_MS;
  for (const player of lobby.players) {
    socketForPid(player.pid)?.emit("phase", {
      name: "roleReveal",
      role: knownTo(roles, player.pid),
      endsAt: phaseEndsAt,
    });
  }
  setPhaseTimer(ROLE_REVEAL_MS, startRound);
}

function startRound() {
  lastResultsPayload = null;
  // Spring the traps set during the gathering.
  roundPenalties = {};
  for (const trap of consumeTraps(cardState)) {
    if (trap.type === "timePenalty") {
      roundPenalties[trap.targetId] =
        (roundPenalties[trap.targetId] ?? 0) + trap.ms / SPEED;
    }
  }

  game = drawGame(box, lastGameId);
  lastGameId = game.id;
  gameState = game.create(lobby.players.map((p) => p.pid));
  runPhase();
}

// Build the phase payload for ONE player. Shared by the live broadcast and by
// reconnect resends, so a returning player sees exactly what everyone else has.
function phasePayloadFor(pid) {
  const penalty = currentPhase.acceptsInput ? roundPenalties[pid] ?? 0 : 0;
  return {
    name: currentPhase.kind, // "story" or "choices"
    gameName: game.name,
    key: currentPhase.key,
    ...currentPhase.broadcast,
    ...(game.personal?.(gameState, pid) ?? {}),
    endsAt: phaseOpenedAt + currentPhase.durationMs / SPEED - penalty,
    cursed: penalty > 0,
  };
}

// The generic engine loop: broadcast the game's current phase, run its
// clock, advance when time is up or everyone has acted.
function runPhase() {
  currentPhase = game.phase(gameState);
  if (!currentPhase) {
    showResults();
    return;
  }
  phaseName = currentPhase.kind;
  phaseOpenedAt = Date.now();
  const durationMs = currentPhase.durationMs / SPEED;
  phaseEndsAt = phaseOpenedAt + durationMs;

  for (const player of lobby.players) {
    socketForPid(player.pid)?.emit("phase", phasePayloadFor(player.pid));
  }
  setPhaseTimer(durationMs, advancePhase);
}

function advancePhase() {
  game.advance(gameState);
  runPhase();
}

function showResults() {
  clearTimeout(phaseTimer);
  phaseName = "results";
  const ranked = game.results(gameState);
  applyRoundPoints(standings, ranked);

  // Rank prizes: winner draws a rare, runner-up a common.
  const awarded = awardByRank(
    cardState,
    ranked.map((r) => r.playerId)
  );
  for (const [pid, cardId] of Object.entries(awarded)) {
    socketForPid(pid)?.emit("cardAwarded", CARDS[cardId]);
    sendHand(pid);
  }

  lastResultsPayload = {
    name: "results",
    gameName: game.name,
    ranked: ranked.map((r, i) => ({
      name: nameOf(r.playerId),
      label: r.label,
      points: r.points,
      totalPoints: total(standings, r.playerId),
      rank: i + 1,
    })),
  };
  io.emit("phase", lastResultsPayload);
  phaseEndsAt = Date.now() + RESULTS_SHOW_MS;
  setPhaseTimer(RESULTS_SHOW_MS, startGathering);
}

// Back at the inn: candles relit, accusations and cards fly.
function startGathering() {
  phaseName = "gathering";
  phaseEndsAt = Date.now() + GATHERING_MS;
  io.emit("phase", { name: "gathering", endsAt: phaseEndsAt });
  for (const player of lobby.players) sendHand(player.pid);
  setPhaseTimer(GATHERING_MS, startRound);
}

// Re-orient a player who just (re)connected mid-game: put them back on the
// current screen with the right clock, and restore their private state.
function resendStateTo(pid) {
  const socket = socketForPid(pid);
  if (!socket || !lobby.started) return; // lobby case handled by "welcome"

  sendHand(pid);
  // Their secret role, restored without re-spinning the wheel.
  if (roles && phaseName !== "roleReveal") {
    socket.emit("roleReminder", knownTo(roles, pid));
  }

  if (phaseName === "roleReveal") {
    socket.emit("phase", {
      name: "roleReveal",
      role: knownTo(roles, pid),
      endsAt: phaseEndsAt,
      resumed: true,
    });
  } else if (phaseName === "story" || phaseName === "choices") {
    socket.emit("phase", { ...phasePayloadFor(pid), resumed: true });
  } else if (phaseName === "results" && lastResultsPayload) {
    socket.emit("phase", { ...lastResultsPayload, resumed: true });
  } else if (phaseName === "gathering") {
    socket.emit("phase", { name: "gathering", endsAt: phaseEndsAt, resumed: true });
  }
}

io.on("connection", (socket) => {
  // Handshake before anything else: the client offers a saved token (or null
  // on a first-ever visit). A known token means "same player, new socket".
  socket.on("hello", (token) => {
    if (token) {
      const result = reconnect(lobby, token, socket.id);
      if (result.ok) {
        clearTimeout(graceTimers[token]); // they came back — cancel cleanup
        delete graceTimers[token];
        socket.emit("welcome", {
          token,
          name: result.player.name,
          started: lobby.started,
        });
        broadcastLobby();
        resendStateTo(result.player.pid);
        return;
      }
    }
    // New visitor, or a token we no longer recognise → show the join screen.
    socket.emit("welcome", { token: null, started: lobby.started });
  });

  socket.on("join", (name) => {
    const result = addPlayer(lobby, socket.id, name);
    if (!result.ok) {
      socket.emit("joinError", result.error);
      return;
    }
    // Hand back the freshly minted token so the browser can remember it.
    socket.emit("joined", { name: String(name).trim(), token: result.pid });
    broadcastLobby();
  });

  socket.on("start", () => {
    const result = startGame(lobby, socket.id);
    if (!result.ok) {
      socket.emit("error_message", result.error);
      return;
    }
    const pids = lobby.players.map((p) => p.pid);
    cardState = createCardState(pids);
    roles = assignRoles(pids);
    broadcastLobby();
    setPhaseTimer(RESULTS_HOLD_MS, startRoleReveal);
  });

  socket.on("input", ({ key, choice }) => {
    const pid = pidOf(socket);
    if (!pid || !game || !currentPhase?.acceptsInput || key !== currentPhase.key) return;
    const timeMs = Date.now() - phaseOpenedAt;
    const allowed =
      currentPhase.durationMs / SPEED - (roundPenalties[pid] ?? 0);
    if (timeMs > allowed) return; // the cursed clock has run out — expected failure
    const result = game.input(gameState, pid, choice, timeMs);
    if (result.ok) {
      socket.emit("inputLocked", { key });
      if (game.everyoneActed(gameState)) {
        clearTimeout(phaseTimer);
        advancePhase();
      }
    }
  });

  socket.on("playCard", ({ cardId, targetName, text }) => {
    const pid = pidOf(socket);
    if (!pid) return;
    if (phaseName !== "gathering" || !cardState) {
      socket.emit("error_message", "Cards can only be played back at the inn");
      return;
    }
    const targetId = targetName ? playerByName(targetName)?.pid ?? null : null;

    const result = playCard(cardState, pid, cardId, targetId);
    if (!result.ok) {
      socket.emit("error_message", result.error);
      return;
    }
    sendHand(pid);

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
      const taken = transferPoints(standings, targetId, pid, result.card.effect.amount);
      feed(`A pickpocket brushes past ${nameOf(targetId)} — ${taken} points lighter.`);
    }
    if (result.card.effect.type === "whisper") {
      const note = String(text ?? "").slice(0, 120).trim();
      if (note) feed(`The barkeep passes a note: “${note}”`);
    }
  });

  // The innkeeper rings the bell: gathering ends now, next round begins.
  socket.on("ringBell", () => {
    const requester = playerBySocket(lobby, socket.id);
    if (!requester?.isHost || !lobby.started || phaseName !== "gathering") return;
    startRound();
  });

  socket.on("disconnect", () => {
    // Mark offline but keep the seat — this might just be a refresh. Matching
    // on socket id means a stale disconnect from a replaced socket is a no-op.
    const player = markDisconnected(lobby, socket.id);
    if (!player) return;
    broadcastLobby();

    // Before the game starts, a player who never comes back should free their
    // seat (and name). After it starts, we keep them — their role and points
    // still matter, and they may yet reconnect.
    if (!lobby.started) {
      const pid = player.pid;
      clearTimeout(graceTimers[pid]);
      graceTimers[pid] = setTimeout(() => {
        const p = playerByPid(lobby, pid);
        if (p && !p.connected) {
          removePlayer(lobby, p.socketId);
          broadcastLobby();
        }
        delete graceTimers[pid];
      }, DISCONNECT_GRACE_MS);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Nights of Shabalabadingdong server on http://localhost:${PORT}`);
});
