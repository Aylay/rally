// ticker.ts — LE BATTEMENT (notre "EventBridge" local).
// Un simple timer fait avancer le match d'un cran, applique le SEUL nouvel
// événement (option B), et le "diffuse". En AWS, ce timer = EventBridge,
// le curseur = un item DynamoDB, le console.log = un push WebSocket.
import { SEED_EVENTS } from "./events.js";
import { applyEvent, blankState } from "./engine.js";
import type { GameEvent, MatchState } from "./events.js";

// Le SCRIPT figé du match (en AWS : une Query DynamoDB ; ici : un tableau trié).
const script: GameEvent[] = [...SEED_EVENTS].sort((a, b) => a.sequence - b.sequence);
const lastSequence = script[script.length - 1].sequence;

// LE CURSEUR D'ÉTAT DE LA BOUCLE (en AWS : un petit item DynamoDB).
interface LoopCursor {
  matchId: string;
  currentSequence: number;
  cycleId: number;
  status: "playing" | "paused";
}
const cursor: LoopCursor = {
  matchId: "fra_aus_2019",
  currentSequence: 0,
  cycleId: 1,
  status: "playing",
};

// L'état "live" que le serveur tient à jour INCRÉMENTALEMENT (un événement à la fois).
let serverState: MatchState = blankState(cursor.matchId);

// Réglages — en prod, bien plus lents (cf. carnet : tick ~3-5 s, pause ~5 min).
const TICK_MS = 1000;
const PAUSE_MS = 3000;

// Donnée de référence : les équipes du match, DANS L'ORDRE (France d'abord).
// En AWS, ça viendra de la table `teams`. C'est ELLE qui dicte l'affichage,
// jamais l'ordre où les paniers sont tombés. On affiche toujours les deux,
// avec 0 par défaut si l'équipe n'a pas encore d'entrée dans scoreByTeam.
const MATCH_TEAMS = [
  { id: "team_fra", label: "FRA" },
  { id: "team_aus", label: "AUS" },
];

const score = (s: MatchState) =>
  MATCH_TEAMS.map((t) => `${t.label} ${s.scoreByTeam[t.id] ?? 0}`).join(" - ");

function tick(): void {
  // 1) avancer le curseur d'un cran
  cursor.currentSequence += 1;
  const e = script.find((ev) => ev.sequence === cursor.currentSequence)!;

  // 2) appliquer LE SEUL nouvel événement (option B) — aucun re-fold complet
  applyEvent(serverState, e);

  // 3) "diffuser" (en prod : push WebSocket à tous les clients connectés)
  console.log(
    `[manche ${cursor.cycleId}] seq ${String(e.sequence).padStart(2)}  ${e.type.padEnd(12)}  ` +
    `${score(serverState).padEnd(16)}  ${e.descriptionFr ?? ""}`,
  );

  // 4) fin de match ? -> pause, puis nouvelle manche
  if (cursor.currentSequence >= lastSequence) {
    console.log(`--- fin du match (manche ${cursor.cycleId}) — pause de ${PAUSE_MS / 1000}s ---\n`);
    cursor.status = "paused";
    setTimeout(startNewCycle, PAUSE_MS);
    return;
  }
  setTimeout(tick, TICK_MS);
}

function startNewCycle(): void {
  cursor.currentSequence = 0;
  cursor.cycleId += 1;
  serverState = blankState(cursor.matchId);
  cursor.status = "playing";
  setTimeout(tick, TICK_MS);
}

console.log(`Rally — le match tourne en boucle (Ctrl+C pour arrêter)\n`);
setTimeout(tick, TICK_MS);