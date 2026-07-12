// lobby.js — the lobby's rules, with no network code.
// The server holds ONE lobby object (single source of truth) and calls
// these functions to change it. Clients only ever see snapshots.

export const MIN_PLAYERS = 2; // low for testing; real games will want 3+

export function createLobby() {
  return { players: [], started: false };
}

// Returns { ok: true } or { ok: false, error: "reason" }.
export function addPlayer(lobby, id, rawName) {
  if (lobby.started) return { ok: false, error: "Game already started" };

  const name = String(rawName ?? "").trim();
  if (name.length < 1 || name.length > 20) {
    return { ok: false, error: "Name must be 1-20 characters" };
  }
  if (lobby.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That name is taken" };
  }

  const isHost = lobby.players.length === 0; // first in = host
  lobby.players.push({ id, name, isHost });
  return { ok: true };
}

export function removePlayer(lobby, id) {
  const wasHost = lobby.players.find((p) => p.id === id)?.isHost ?? false;
  lobby.players = lobby.players.filter((p) => p.id !== id);

  // If the host left, the longest-waiting player inherits the crown.
  if (wasHost && lobby.players.length > 0) {
    lobby.players[0].isHost = true;
  }
}

export function canStart(lobby) {
  return !lobby.started && lobby.players.length >= MIN_PLAYERS;
}

// Only the host can start, and only with enough players.
export function startGame(lobby, requesterId) {
  const requester = lobby.players.find((p) => p.id === requesterId);
  if (!requester?.isHost) return { ok: false, error: "Only the host can start" };
  if (!canStart(lobby)) {
    return { ok: false, error: `Need at least ${MIN_PLAYERS} players` };
  }
  lobby.started = true;
  return { ok: true };
}

// What clients are allowed to see (no socket ids leaked to other players).
export function publicState(lobby) {
  return {
    started: lobby.started,
    canStart: canStart(lobby),
    players: lobby.players.map((p) => ({ name: p.name, isHost: p.isHost })),
  };
}
