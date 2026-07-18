// roles.js — secret roles, dealt once at the start of the night.
// Like cards.js, ROLE DEFINITIONS are data. The rules here only decide WHO
// gets what and WHO may see it; what a role can actually DO lives in the
// engine and the mini-games.
//
// Everyone is blind: you learn your own role and nothing else. The whole
// night is spent guessing at the rest.

export const ROLES = {
  culprit: {
    id: "culprit",
    name: "The Culprit",
    alignment: "solo",
    description:
      "You did it. Whatever it was, you did it. Survive the night without being named.",
  },
  sheriff: {
    id: "sheriff",
    name: "The Sheriff",
    alignment: "law",
    description:
      "One guilty traveler sits at this table. Find them before the last candle gutters.",
  },
  guard: {
    id: "guard",
    name: "The Guard",
    alignment: "neutral",
    description:
      "You carry a blade and no particular loyalty. Someone will make it worth your while.",
  },
  villager: {
    id: "villager",
    name: "Traveler",
    alignment: "town",
    description:
      "You came here for the ale. Stay alive, stay unblamed, and maybe win a little coin.",
  },
};

// How the table fills up as more travelers arrive. Checked biggest-first,
// so adding a role means adding a row — not editing the logic below.
const ROSTER = [
  { minPlayers: 5, roles: ["culprit", "sheriff", "guard"] },
  { minPlayers: 3, roles: ["culprit", "sheriff"] },
  { minPlayers: 1, roles: ["culprit"] },
];

// Which special roles are in play at this headcount? Everyone else is a
// villager.
export function rosterFor(playerCount) {
  return ROSTER.find((r) => playerCount >= r.minPlayers)?.roles ?? [];
}

// Fisher-Yates, seedable so tests aren't at the mercy of chance.
function shuffled(items, rng) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Deal the night's roles. Returns playerId -> roleId for EVERY player.
// This is the server's private copy — it must never be broadcast whole.
export function assignRoles(playerIds, rng = Math.random) {
  if (!playerIds.length) throw new Error("Nobody to deal roles to");

  const special = rosterFor(playerIds.length);
  const order = shuffled(playerIds, rng);
  const byPlayer = {};

  order.forEach((playerId, i) => {
    byPlayer[playerId] = special[i] ?? "villager";
  });
  return byPlayer;
}

// What this player is allowed to know. Everyone is blind, so: your own role
// and a headcount of what's out there — enough to reason, not enough to cheat.
export function knownTo(byPlayer, playerId) {
  const roleId = byPlayer[playerId];
  if (!roleId) return null;

  const counts = {};
  for (const id of Object.values(byPlayer)) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
  // Names travel with the counts — the client keeps no copy of role content.
  const table = Object.entries(counts).map(([id, count]) => ({
    id,
    name: ROLES[id].name,
    count,
  }));
  return { ...ROLES[roleId], table };
}

// Convenience for the engine and future win checks.
export function playersWithRole(byPlayer, roleId) {
  return Object.keys(byPlayer).filter((id) => byPlayer[id] === roleId);
}
