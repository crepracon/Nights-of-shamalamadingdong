import { describe, it, expect } from "vitest";
import {
  createLobby,
  addPlayer,
  removePlayer,
  reconnect,
  markDisconnected,
  playerByPid,
  startGame,
  canStart,
} from "../src/lobby.js";

describe("lobby", () => {
  it("makes the first player host and rejects duplicate names", () => {
    const lobby = createLobby();
    expect(addPlayer(lobby, "s1", "Chris").ok).toBe(true);
    expect(lobby.players[0].isHost).toBe(true);

    const dupe = addPlayer(lobby, "s2", "  chris "); // case/space-insensitive
    expect(dupe.ok).toBe(false);
    expect(dupe.error).toBe("That name is taken");
  });

  it("promotes the next player when the host leaves", () => {
    const lobby = createLobby();
    addPlayer(lobby, "s1", "Host");
    addPlayer(lobby, "s2", "Second");
    removePlayer(lobby, "s1");
    expect(lobby.players).toHaveLength(1);
    expect(lobby.players[0].name).toBe("Second");
    expect(lobby.players[0].isHost).toBe(true);
  });

  it("only lets the host start, and only with enough players", () => {
    const lobby = createLobby();
    addPlayer(lobby, "s1", "Host");
    expect(startGame(lobby, "s1").ok).toBe(false); // alone: not enough players

    addPlayer(lobby, "s2", "Guest");
    expect(startGame(lobby, "s2").ok).toBe(false); // guest: not the host
    expect(startGame(lobby, "s1").ok).toBe(true);  // host with 2+: go
    expect(lobby.started).toBe(true);
    expect(canStart(lobby)).toBe(false);           // can't start twice
  });

  it("rejects joins after the game has started", () => {
    const lobby = createLobby();
    addPlayer(lobby, "s1", "Host");
    addPlayer(lobby, "s2", "Guest");
    startGame(lobby, "s1");
    expect(addPlayer(lobby, "s3", "Late").ok).toBe(false);
  });

  it("mints a stable pid on join and starts connected", () => {
    const lobby = createLobby();
    const result = addPlayer(lobby, "sock-1", "Chris");
    expect(result.ok).toBe(true);
    expect(result.pid).toBeTruthy();
    expect(lobby.players[0].pid).toBe(result.pid);
    expect(lobby.players[0].socketId).toBe("sock-1");
    expect(lobby.players[0].connected).toBe(true);
  });

  it("reconnects by token: keeps the seat, rebinds to the new socket", () => {
    const lobby = createLobby();
    const { pid } = addPlayer(lobby, "old-sock", "Chris");
    startGame(lobby, "old-sock"); // pretend we're mid-game (needs 2, but ok for state)

    markDisconnected(lobby, "old-sock");
    expect(lobby.players[0].connected).toBe(false);

    const result = reconnect(lobby, pid, "new-sock");
    expect(result.ok).toBe(true);
    expect(lobby.players).toHaveLength(1); // same seat, not a new one
    expect(lobby.players[0].socketId).toBe("new-sock");
    expect(lobby.players[0].connected).toBe(true);
    expect(playerByPid(lobby, pid).name).toBe("Chris");
  });

  it("rejects reconnect with an unknown token", () => {
    const lobby = createLobby();
    addPlayer(lobby, "s1", "Chris");
    expect(reconnect(lobby, "not-a-real-token", "s2").ok).toBe(false);
  });

  it("ignores a stale disconnect from a socket that was already replaced", () => {
    const lobby = createLobby();
    const { pid } = addPlayer(lobby, "old-sock", "Chris");
    reconnect(lobby, pid, "new-sock"); // player now lives on new-sock

    // The old socket's disconnect fires late — it must NOT knock the player
    // (now on new-sock) offline.
    markDisconnected(lobby, "old-sock");
    expect(lobby.players[0].connected).toBe(true);
    expect(lobby.players[0].socketId).toBe("new-sock");
  });
});
