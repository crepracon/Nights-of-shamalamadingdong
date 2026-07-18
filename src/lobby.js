// lobby.js — the lobby's rules, with no network code.
// The server holds ONE lobby object (single source of truth) and calls
// these functions to change it. Clients only ever see snapshots.
//
// Identity vs. address: every player has a stable `pid` (minted once, saved
// in their browser) AND a `socketId` (their CURRENT connection, which changes
// on every refresh). Roles, hands, and points are all filed under `pid`, so a
// refresh never loses them — reconnect() just rebinds the pid to a new socket.

import { randomUUID } from "crypto";

export const MIN_PLAYERS = 2; // low for testing; real games will want 3+

export function createLobby() {
  return { players: [], started: false };
}

// A stable, unguessable player token. Injectable so tests are deterministic.
function defaultPid() {
  return randomUUID();
}

// Returns { ok: true, pid } or { ok: false, error: "reason" }.
export function addPlayer(lobby, socketId, rawName, makePid = defaultPid) {
  if (lobby.started) return { ok: false, error: "Game already started" };

  const name = String(rawName ?? "").trim();
  if (name.length < 1 || name.length > 20) {
    return { ok: false, error: "Name must be 1-20 characters" };
  }
  if (lobby.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That name is taken" };
  }

  const isHost = lobby.players.length === 0; // first in = host
  const pid = makePid();
  lobby.players.push({ pid, name, isHost, socketId, connected: true });
  return { ok: true, pid };
}

// A returning player: same pid (token), fresh socket. Rebind and mark online.
// Safe by design — matches on the stable pid, not the throwaway socketId.
export function reconnect(lobby, token, socketId) {
  const player = lobby.players.find((p) => p.pid === token);
  if (!player) return { ok: false, error: "Unknown token" };
  player.socketId = socketId;
  player.connected = true;
  return { ok: true, player };
}

// A socket dropped. Mark the player offline but KEEP their seat and state —
// they may just be refreshing. Matches on socketId, so a stale disconnect from
// an old connection that's already been replaced is a harmless no-op.
export function markDisconnected(lobby, socketId) {
  const player = lobby.players.find((p) => p.socketId === socketId);
  if (player) player.connected = false;
  return player ?? null;
}

// Hard-remove a player (used for genuine leaves in the lobby, not refreshes).
export function removePlayer(lobby, socketId) {
  const wasHost =
    lobby.players.find((p) => p.socketId === socketId)?.isHost ?? false;
  lobby.players = lobby.players.filter((p) => p.socketId !== socketId);

  // If the host left, the longest-waiting player inherits the crown.
  if (wasHost && lobby.players.length > 0) {
    lobby.players[0].isHost = true;
  }
}

export function playerBySocket(lobby, socketId) {
  return lobby.players.find((p) => p.socketId === socketId) ?? null;
}

export function playerByPid(lobby, pid) {
  return lobby.players.find((p) => p.pid === pid) ?? null;
}

export function canStart(lobby) {
  return !lobby.started && lobby.players.length >= MIN_PLAYERS;
}

// Only the host can start, and only with enough players. Identified by the
// requester's live socket — they're connected right now, so socketId is valid.
export function startGame(lobby, requesterSocketId) {
  const requester = lobby.players.find((p) => p.socketId === requesterSocketId);
  if (!requester?.isHost) return { ok: false, error: "Only the host can start" };
  if (!canStart(lobby)) {
    return { ok: false, error: `Need at least ${MIN_PLAYERS} players` };
  }
  lobby.started = true;
  return { ok: true };
}

// What clients are allowed to see — never the pid or socketId. `connected`
// lets the UI show who's currently at the table.
export function publicState(lobby) {
  return {
    started: lobby.started,
    canStart: canStart(lobby),
    players: lobby.players.map((p) => ({
      name: p.name,
      isHost: p.isHost,
      connected: p.connected,
    })),
  };
}
