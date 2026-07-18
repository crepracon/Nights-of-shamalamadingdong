import { io } from "socket.io-client";
import { appendFileSync } from "fs";
const t0 = Date.now();
const log = (...args) => appendFileSync("/tmp/bot.log", ((Date.now()-t0)/1000).toFixed(1) + "s " + args.join(" ") + "\n");
const a = io("http://localhost:3000");
const b = io("http://localhost:3000");
let aHand = [];
const gamesSeen = new Set();
let resultsSeen = 0;

b.on("phase", p => {
  if (p.name === "choices") setTimeout(() => b.emit("input", { key: p.key, choice: 1 }), 300);
});
b.on("tavernFeed", m => log("B sees feed:", m));
a.on("hand", h => { aHand = h; log("A hand update:", h.map(c => c.name).join(", ") || "(empty)"); });
a.on("cardAwarded", c => log("A won card:", c.name));
a.on("privateNote", m => log("A private:", m));
a.on("phase", p => {
  if (p.name === "story") log("STORY (" + p.gameName + ")");
  if (p.name === "choices") {
    gamesSeen.add(p.gameName);
    if (p.prompt && p.gameName === "The Dice Pot") log("DICE prompt for A:", p.prompt, "|", p.table);
    if (p.cursed) log("A is CURSED on", p.key);
    setTimeout(() => a.emit("input", { key: p.key, choice: 0 }), 150);
  }
  if (p.name === "results") {
    resultsSeen++;
    log("RESULTS (" + p.gameName + "):", p.ranked.map(r => r.name + " " + r.label + " +" + r.points + " (total " + r.totalPoints + ")").join("  "));
    if (gamesSeen.size >= 2) { log("BOX ALTERNATION VERIFIED — both games played"); process.exit(0); }
  }
  if (p.name === "gathering") {
    log("GATHERING. A holds:", aHand.map(c => c.name).join(", ") || "nothing");
    setTimeout(() => {
      const card = aHand[0];
      if (card) {
        log("A plays", card.name);
        a.emit("playCard", { cardId: card.id, targetName: card.needsTarget ? "Gandalf" : undefined, text: card.needsText ? "The dwarf did it." : undefined });
      }
      setTimeout(() => a.emit("ringBell"), 1500);
    }, 800);
  }
});
a.emit("join", "Chris");
setTimeout(() => b.emit("join", "Gandalf"), 200);
setTimeout(() => a.emit("start"), 400);
setTimeout(() => { log("BOT TIMEOUT — game never finished"); process.exit(1); }, 40000);
