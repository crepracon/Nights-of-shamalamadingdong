// client.js — the thin display layer (rule 2).
// Sends inputs, draws whatever phase the server broadcasts. No rules here.

const socket = io();

const views = {
  join: document.getElementById("join-view"),
  lobby: document.getElementById("lobby-view"),
  role: document.getElementById("role-view"),
  story: document.getElementById("story-view"),
  choices: document.getElementById("choices-view"),
  results: document.getElementById("results-view"),
  gathering: document.getElementById("gathering-view"),
};

const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const playerList = document.getElementById("player-list");
const waitNote = document.getElementById("wait-note");
const startBtn = document.getElementById("start-btn");
const lobbyError = document.getElementById("lobby-error");
const storyGameName = document.getElementById("story-game-name");
const storyText = document.getElementById("story-text");
const storyTimer = document.getElementById("story-timer");
const choicesProgress = document.getElementById("choices-progress");
const choicesPrompt = document.getElementById("choices-prompt");
const choicesTable = document.getElementById("choices-table");
const resultsTitle = document.getElementById("results-title");
const optionsBox = document.getElementById("options");
const lockedNote = document.getElementById("locked-note");
const choicesTimer = document.getElementById("choices-timer");
const scoreList = document.getElementById("score-list");
const gatheringTimer = document.getElementById("gathering-timer");
const feedBox = document.getElementById("feed");
const handBox = document.getElementById("hand");
const targetPick = document.getElementById("target-pick");
const targetOptions = document.getElementById("target-options");
const bellBtn = document.getElementById("bell-btn");
const gatheringNote = document.getElementById("gathering-note");
const wheel = document.getElementById("wheel");
const roleCard = document.getElementById("role-card");
const roleName = document.getElementById("role-name");
const roleDesc = document.getElementById("role-desc");
const roleCounts = document.getElementById("role-counts");
const roleSpinNote = document.getElementById("role-spin-note");
const roleTimer = document.getElementById("role-timer");
const roleBadge = document.getElementById("role-badge");
const roleBadgeText = document.getElementById("role-badge-text");

let myRole = null;
let myName = null;
let iAmHost = false;
let travelers = []; // everyone's names, for the target picker
let timerLoop = null;

function showOnly(name) {
  const current = Object.entries(views).find(([, el]) => !el.hidden);
  const reveal = () => {
    for (const [key, el] of Object.entries(views)) {
      el.hidden = key !== name;
      el.classList.remove("fade-out");
    }
  };
  if (current && current[0] !== name) {
    current[1].classList.add("fade-out");
    setTimeout(reveal, 550); // matches the CSS fade
  } else {
    reveal();
  }
}

// Animate a timer bar toward a server deadline.
function runTimer(fillEl, endsAt) {
  clearInterval(timerLoop);
  const total = endsAt - Date.now();
  timerLoop = setInterval(() => {
    const left = Math.max(0, endsAt - Date.now());
    fillEl.style.transform = `scaleX(${total > 0 ? left / total : 0})`;
    if (left <= 0) clearInterval(timerLoop);
  }, 100);
}

// ---- Identity that survives a refresh ----
// The server files our role, hand, and points under a token it minted when we
// first joined. We stash it in the browser so a reconnect proves "same player"
// even though the socket underneath is brand new.
const TOKEN_KEY = "nights-token";

socket.on("connect", () => {
  socket.emit("hello", localStorage.getItem(TOKEN_KEY));
});

socket.on("welcome", ({ token, name, started }) => {
  if (token) {
    // Recognised — we already have a seat. Remember who we are; if a game is
    // running the server will push the current phase to the right screen.
    myName = name;
    if (!started) showOnly("lobby");
  } else {
    // New here, or our old token expired. Start fresh at the join screen.
    localStorage.removeItem(TOKEN_KEY);
    showOnly("join");
  }
});

// Restore our secret role after a mid-game reconnect (no wheel re-spin).
socket.on("roleReminder", (role) => {
  myRole = role;
  showBadge();
});

// ---- Join ----
joinBtn.addEventListener("click", join);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});

function join() {
  joinError.hidden = true;
  socket.emit("join", nameInput.value);
}

socket.on("joinError", (message) => {
  joinError.textContent = message;
  joinError.hidden = false;
});

socket.on("joined", ({ name, token }) => {
  myName = name;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  showOnly("lobby");
});

socket.on("error_message", (message) => {
  lobbyError.textContent = message;
  lobbyError.hidden = false;
});

// ---- Lobby ----
socket.on("lobby", (state) => {
  // Keep these current even mid-game: a host who refreshes still needs the
  // bell, and the target picker needs the full traveler list.
  travelers = state.players.map((p) => p.name);
  iAmHost = state.players.some((p) => p.isHost && p.name === myName);

  if (state.started) return; // phase events drive the screens now

  playerList.innerHTML = "";
  for (const player of state.players) {
    const li = document.createElement("li");
    li.textContent = player.name;
    if (!player.connected) li.classList.add("offline");
    if (player.isHost) {
      const mark = document.createElement("span");
      mark.className = "host-mark";
      mark.textContent = "(innkeeper)";
      li.appendChild(mark);
    }
    playerList.appendChild(li);
  }

  const canStart = iAmHost && state.canStart;
  startBtn.hidden = !canStart;
  waitNote.hidden = canStart;
  waitNote.textContent = iAmHost
    ? "Waiting for more travelers to arrive…"
    : "Waiting for the innkeeper to open the taps…";
});

startBtn.addEventListener("click", () => {
  lobbyError.hidden = true;
  socket.emit("start");
});

// ---- Game phases (server-driven) ----
socket.on("phase", (phase) => {
  if (phase.name === "roleReveal") {
    myRole = phase.role;
    showOnly("role");
    runTimer(roleTimer, phase.endsAt);

    const revealCard = () => {
      roleSpinNote.hidden = true;
      roleName.textContent = myRole.name;
      roleDesc.textContent = myRole.description;
      roleCounts.textContent =
        "At this table: " +
        myRole.table.map((r) => `${r.count} × ${r.name}`).join(", ");
      roleCard.hidden = false;
      showBadge();
    };

    if (phase.resumed) {
      // Reconnected mid-reveal — skip the theatrics, just show the fate.
      wheel.classList.remove("spinning");
      revealCard();
    } else {
      roleCard.hidden = true;
      roleSpinNote.hidden = false;
      wheel.classList.remove("spinning");
      void wheel.offsetWidth; // forces the browser to replay it
      wheel.classList.add("spinning");
      setTimeout(revealCard, 4200); // just after the wheel settles
    }
  }

  if (phase.name === "story") {
    storyGameName.textContent = phase.gameName ?? "";
    storyText.textContent = phase.text;
    showOnly("story");
    runTimer(storyTimer, phase.endsAt);
  }

  if (phase.name === "choices") {
    choicesProgress.textContent =
      (phase.progress ?? "") +
      (phase.cursed ? " — your clock runs short. Cursed dice…" : "");
    choicesPrompt.textContent = phase.prompt;
    choicesTable.hidden = !phase.table;
    choicesTable.textContent = phase.table ?? "";
    lockedNote.hidden = true;
    optionsBox.innerHTML = "";
    phase.options.forEach((option, choice) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => {
        socket.emit("input", { key: phase.key, choice });
        btn.classList.add("chosen");
        for (const b of optionsBox.querySelectorAll("button")) b.disabled = true;
      });
      optionsBox.appendChild(btn);
    });
    showOnly("choices");
    runTimer(choicesTimer, phase.endsAt);
  }

  if (phase.name === "results") {
    resultsTitle.textContent = `${phase.gameName ?? ""} — results`;
    scoreList.innerHTML = "";
    for (const row of phase.ranked) {
      const li = document.createElement("li");
      li.textContent = `${row.name} — ${row.label}`;
      const pts = document.createElement("span");
      pts.className = "pts";
      pts.textContent = `+${row.points} (${row.totalPoints})`;
      li.appendChild(pts);
      scoreList.appendChild(li);
    }
    showOnly("results");
  }

  if (phase.name === "gathering") {
    targetPick.hidden = true;
    bellBtn.hidden = !iAmHost;
    gatheringNote.textContent = iAmHost
      ? ""
      : "The innkeeper will ring the bell when it's time…";
    showOnly("gathering");
    runTimer(gatheringTimer, phase.endsAt);
  }
});

socket.on("inputLocked", () => {
  lockedNote.hidden = false;
});

// The badge stays put all night, but keeps its mouth shut until you tap it —
// no one glancing at your screen learns anything.
function showBadge() {
  roleBadge.hidden = false;
}

roleBadge.addEventListener("click", () => {
  if (!myRole) return;
  const showing = !roleBadgeText.hidden;
  roleBadgeText.textContent = showing ? "" : `${myRole.name} — ${myRole.description}`;
  roleBadgeText.hidden = showing;
  roleBadge.textContent = showing ? "Your fate ▾" : "Hide ▴";
});

bellBtn.addEventListener("click", () => socket.emit("ringBell"));

// ---- Cards ----
function addFeed(text, isPrivate = false) {
  const p = document.createElement("p");
  p.textContent = text;
  if (isPrivate) p.className = "private";
  feedBox.appendChild(p);
  feedBox.scrollTop = feedBox.scrollHeight;
}

socket.on("tavernFeed", (message) => addFeed(message));
socket.on("privateNote", (message) => addFeed(message, true));
socket.on("cardAwarded", (card) => addFeed(`You won a card: ${card.name} — ${card.description}`, true));

socket.on("hand", (cards) => {
  handBox.innerHTML = "";
  if (cards.length === 0) {
    const span = document.createElement("span");
    span.className = "empty-hand";
    span.textContent = "No cards. Win the next game to earn one.";
    handBox.appendChild(span);
    return;
  }
  for (const card of cards) {
    const btn = document.createElement("button");
    const title = document.createElement("b");
    title.textContent = card.name;
    const desc = document.createElement("small");
    desc.textContent = card.description;
    btn.append(title, desc);
    btn.addEventListener("click", () => beginPlay(card));
    handBox.appendChild(btn);
  }
});

function beginPlay(card) {
  if (card.needsText) {
    const text = window.prompt("What should the note say?");
    if (text) socket.emit("playCard", { cardId: card.id, text });
    return;
  }
  if (!card.needsTarget) {
    socket.emit("playCard", { cardId: card.id });
    return;
  }
  // Pick a target from the other travelers
  targetOptions.innerHTML = "";
  for (const name of travelers.filter((n) => n !== myName)) {
    const btn = document.createElement("button");
    btn.textContent = name;
    btn.addEventListener("click", () => {
      targetPick.hidden = true;
      socket.emit("playCard", { cardId: card.id, targetName: name });
    });
    targetOptions.appendChild(btn);
  }
  targetPick.hidden = false;
}
