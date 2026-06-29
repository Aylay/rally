// run.ts — fait tourner le moteur et affiche l'état dérivé.
import { SEED_EVENTS } from "../src/events.js";
import { deriveState } from "../src/engine.js";
import type { MatchState } from "../src/events.js";

// Petite table de correspondance id -> nom (en vrai, ce sera la table `teams`).
const TEAM_NAMES: Record<string, string> = {
  team_fra: "France",
  team_aus: "Australie",
};

function showState(label: string, s: MatchState): void {
  console.log(`\n=== ${label} ===`);
  console.log(`status        : ${s.status}`);
  console.log(`quart-temps   : Q${s.period}  (horloge ${s.gameClock})`);
  console.log(`séquence       : ${s.lastSequence}`);
  const score = Object.entries(s.scoreByTeam)
    .map(([id, pts]) => `${TEAM_NAMES[id] ?? id} ${pts}`)
    .join("  —  ");
  console.log(`score (dérivé) : ${score || "0 — 0"}`);
  console.log(`points/joueur  : ${JSON.stringify(s.pointsByPlayer)}`);
}

// 1) État complet : on replie tout le flux disponible.
showState("Snapshot — tout le flux replié", deriveState(SEED_EVENTS));

// 2) Le pouvoir du snapshot : l'état exact qu'un nouveau venu recevrait
//    s'il rejoignait pile à la séquence 5, AVANT le 3pts de Batum (séq. 7).
showState("Snapshot — un visiteur arrive à la séquence 5", deriveState(SEED_EVENTS, 5));
