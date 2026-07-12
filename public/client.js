// client.js — the thin display layer (rule 2).
// It sends inputs to the server and draws whatever state comes back.
// No game rules live here.

const socket = io();

const joinView = document.getElementById("join-view");
const lobbyView = document.getElementById("lobby-view");
const gameView = document.getElementById("game-view");
const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const playerList = document.getElementById("player-list");
const waitNote = document.getElementById("wait-note");
const startBtn = document.getElementById("start-btn");
const lobbyError = document.getElementById("lobby-error");

let myName = null;

function show(el, visible) {
  el.hidden = !visible;
}

joinBtn.addEventListener("click", join);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") join();
});

function join() {
  show(joinError, false);
  socket.emit("join", nameInput.value);
}

socket.on("joinError", (message) => {
  joinError.textContent = message;
  show(joinError, true);
});

socket.on("error_message", (message) => {
  lobbyError.textContent = message;
  show(lobbyError, true);
});

socket.on("joined", ({ name }) => {
  myName = name;
  show(joinView, false);
  show(lobbyView, true);
});

socket.on("lobby", (state) => {
  if (state.started) {
    show(lobbyView, false);
    show(gameView, true);
    return;
  }

  // Redraw the guest list from server state.
  playerList.innerHTML = "";
  let iAmHost = false;
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
  show(startBtn, canStart);
  show(waitNote, !canStart);
  waitNote.textContent = iAmHost
    ? "Waiting for more travelers to arrive…"
    : "Waiting for the innkeeper to open the taps…";
});

startBtn.addEventListener("click", () => {
  show(lobbyError, false);
  socket.emit("start");
});
