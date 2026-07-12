import { describe, it, expect } from "vitest";
import {
  createLobby,
  addPlayer,
  removePlayer,
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
});
