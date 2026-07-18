import { io } from "socket.io-client";
import { appendFileSync } from "fs";
const t0 = Date.now();
const log = (...args) => appendFileSync("/tmp/bot.log", ((Date.now()-t0)/1000).toFixed(1) + "s " + args.join(" ") + "\n");
const a = io("http://localhost:3000");
const b = io("http://localhost:3000");
let narrations = 0;
let aHand = [];

b.on("phase", p => {
  if (p.name === "question") setTimeout(() => b.emit("answer", { questionIndex: p.index, optionIndex: 1 }), 300);
});
b.on("tavernFeed", m => log("B sees feed:", m));
a.on("hand", h => { aHand = h; log("A hand update:", h.map(c => c.name).join(", ") || "(empty)"); });
a.on("cardAwarded", c => log("A won card:", c.name));
a.on("privateNote", m => log("A private:", m));
a.on("phase", p => {
  if (p.name === "narration") {
    narrations++;
    log("NARRATION", narrations, p.endsAt ? "(" + Math.round((p.endsAt-Date.now())/1000) + "s)" : "");
    if (narrations === 2) { log("FULL CARD LOOP VERIFIED"); process.exit(0); }
  }
  if (p.name === "question") {
    if (p.cursed) log("A is CURSED on Q" + (p.index+1));
    setTimeout(() => a.emit("answer", { questionIndex: p.index, optionIndex: 0 }), 150);
  }
  if (p.name === "results") log("RESULTS:", p.ranked.map(r => r.name + " +" + r.points + " (total " + r.totalPoints + ")").join("  "));
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
