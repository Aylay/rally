// leaderboard-demo.ts — PREUVE du classement partagé déterministe (+ ex æquo).
// À lancer comme predictions-demo.ts. Deux "clients" avec les mêmes picks relayés →
// classement identique ; ex æquo au même rang ; bots qui varient selon la manche.
import { computeStandings, type ScorablePrediction } from "../src/leaderboard.js";
import { SEED_EVENTS } from "../src/events.js";

const PREDICTIONS: ScorablePrediction[] = [
  { id: "pred_q1_leader",    options: ["team_fra", "team_aus"], lockAtSequence: 11, resolveAtSequence: 16, resolveOn: "team" },
  { id: "pred_h1_topscorer", options: ["player_ingles", "player_fournier", "player_mills"], lockAtSequence: 24, resolveAtSequence: 31, resolveOn: "player" },
  { id: "pred_bronze",       options: ["team_fra", "team_aus"], lockAtSequence: 60, resolveAtSequence: 72, resolveOn: "team" },
];

// Ce que le WebSocket aura relayé à TOUS les clients (mêmes picks partout).
const humanPicks: Record<string, Record<string, string>> = {
  lucas: { pred_q1_leader: "team_aus", pred_h1_topscorer: "player_ingles", pred_bronze: "team_fra" }, // 3/3
  marie: { pred_q1_leader: "team_aus", pred_h1_topscorer: "player_mills",  pred_bronze: "team_fra" }, // 2/3 → ex æquo
};

const last = SEED_EVENTS[SEED_EVENTS.length - 1].sequence;
const run = (cycleIndex: number, seq: number) =>
  computeStandings({ cycleIndex, seq, events: SEED_EVENTS, predictions: PREDICTIONS, humanPicks });

const A = run(1, last);
const B = run(1, last); // un autre client, mêmes entrées

console.log("=== Leaderboard — fin de manche 1 ===");
A.forEach((s) => console.log(`  ${s.rank}. ${s.name.padEnd(8)} ${String(s.points).padStart(3)} pts${s.isBot ? "  🤖" : ""}`));
console.log(`\nDéterminisme (A === B) : ${JSON.stringify(A) === JSON.stringify(B) ? "✅ IDENTIQUE" : "❌ DIVERGE"}`);

const bots1 = run(1, last).filter((s) => s.isBot).map((s) => s.name + s.points).join();
const bots2 = run(2, last).filter((s) => s.isBot).map((s) => s.name + s.points).join();
console.log(`Variété entre manches : ${bots1 !== bots2 ? "✅ les bots bougent" : "— identiques"}`);