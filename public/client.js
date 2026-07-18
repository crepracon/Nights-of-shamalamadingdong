// client.js — the thin display layer (rule 2).
// Sends inputs, draws whatever phase the server broadcasts. No rules here.

const socket = io();

const views = {
  join: document.getElementById("join-view"),
  lobby: document.getElementById("lobby-view"),
  narration: document.getElementById("narration-view"),
  question: document.getElementById("question-view"),
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
const narrationText = document.getElementById("narration-text");
const narrationTimer = document.getElementById("narration-timer");
const questionCount = document.getElementById("question-count");
const questionText = document.getElementById("question-text");
const optionsBox = document.getElementById("options");
const lockedNote = document.getElementById("locked-note");
const questionTimer = document.getElementById("question-timer");
const scoreList = document.getElementById("score-list");
const gatheringTimer = document.getElementById("gathering-timer");
const feedBox = document.getElementById("feed");
const handBox = document.getElementById("hand");
const targetPick = document.getElementById("target-pick");
const targetOptions = document.getElementById("target-options");
const bellBtn = document.getElementById("bell-btn");
const gatheringNote = document.getElementById("gathering-note");

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

socket.on("joined", ({ name }) => {
  myName = name;
  showOnly("lobby");
});

socket.on("error_message", (message) => {
  lobbyError.textContent = message;
  lobbyError.hidden = false;
});

// ---- Lobby ----
socket.on("lobby", (state) => {
  if (state.started) return; // phase events drive the screens now

  playerList.innerHTML = "";
  iAmHost = false;
  travelers = state.players.map((p) => p.name);
  for (const player of state.players) {
    const li = document.createElement("li");
    li.textContent = player.name;
    if (player.isHost) {
      const mark = document.createElement("span");
      mark.className = "host-mark";
      mark.textContent = "(innkeeper)";
      li.appendChild(mark);
      if (player.name === myName) iAmHost = true;
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
  if (phase.name === "narration") {
    narrationText.textContent = phase.narration;
    showOnly("narration");
    runTimer(narrationTimer, phase.endsAt);
  }

  if (phase.name === "question") {
    questionCount.textContent =
      `Question ${phase.index + 1} of ${phase.total}` +
      (phase.cursed ? " — your clock runs short. Cursed dice…" : "");
    questionText.textContent = phase.question;
    lockedNote.hidden = true;
    optionsBox.innerHTML = "";
    phase.options.forEach((option, optionIndex) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => {
        socket.emit("answer", { questionIndex: phase.index, optionIndex });
        btn.classList.add("chosen");
        for (const b of optionsBox.querySelectorAll("button")) b.disabled = true;
      });
      optionsBox.appendChild(btn);
    });
    showOnly("question");
    runTimer(questionTimer, phase.endsAt);
  }

  if (phase.name === "results") {
    scoreList.innerHTML = "";
    for (const row of phase.ranked) {
      const li = document.createElement("li");
      li.textContent = `${row.name} — ${row.correct}/${row.of} correct`;
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

socket.on("answerLocked", () => {
  lockedNote.hidden = false;
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
