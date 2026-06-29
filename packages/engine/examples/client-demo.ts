// client-demo.ts — LE MOMENT OÙ TOUT SE REJOINT.
// On prouve qu'un client arrivé EN PLEIN MATCH finit EXACTEMENT synchro avec
// un client connecté depuis le début.
//   - à la connexion : le serveur envoie le SNAPSHOT (deriveState) — une fois ;
//   - ensuite        : le serveur diffuse chaque événement (applyEvent) — le live.
// Même brique, deux moments.
//
// (Aucun timer ici : le QUAND n'est pas le sujet. On prouve que, peu importe
//  l'instant d'arrivée, tout le monde converge vers le même état.)
import { SEED_EVENTS } from "../src/events.js";
import { blankState, deriveState, applyEvent } from "../src/engine.js";
import type { GameEvent, MatchState } from "../src/events.js";

const script: GameEvent[] = [...SEED_EVENTS].sort((a, b) => a.sequence - b.sequence);

const MATCH_TEAMS = [
  { id: "team_fra", label: "FRA" },
  { id: "team_aus", label: "AUS" },
];
const score = (s: MatchState) =>
  MATCH_TEAMS.map((t) => `${t.label} ${s.scoreByTeam[t.id] ?? 0}`).join(" - ");

// --- LE SERVEUR (simplifié) ---
const serverState = blankState("fra_aus_2019");

interface Client { name: string; state: MatchState; }
const clients: Client[] = []; // en AWS : la table des connexions WebSocket

// À LA CONNEXION : le serveur calcule le snapshot et l'envoie. Une seule fois.
// En AWS : la route $connect du WebSocket renvoie ce snapshot au nouveau venu.
function connect(name: string, currentSequence: number): Client {
  const snapshot = deriveState(script, currentSequence);
  const c: Client = { name, state: snapshot };
  clients.push(c); // à partir d'ici, il est abonné au live
  console.log(`  >> ${name} se connecte (séq. ${currentSequence}) — snapshot reçu : ${score(snapshot)}`);
  return c;
}

// À CHAQUE BATTEMENT : le serveur pousse le nouvel événement à tous les abonnés.
// En AWS : un push API Gateway WebSocket vers chaque connexion enregistrée.
function broadcast(e: GameEvent): void {
  for (const c of clients) applyEvent(c.state, e); // option B, côté client
}

// --- LA SIMULATION ---
console.log("Alice est là dès le coup d'envoi :");
const alice = connect("Alice", 0); // snapshot vide : rien n'a encore eu lieu

let bob: Client | undefined;
let chloe: Client | undefined;
for (const e of script) {
  applyEvent(serverState, e); // le serveur avance d'un cran
  broadcast(e);               // tous les abonnés reçoivent le live

  console.log(`[séq ${String(e.sequence).padStart(2)}] ${e.type.padEnd(12)} serveur: ${score(serverState)}`);

  if (e.sequence === 5) {
    console.log("Bob débarque en plein match :");
    bob = connect("Bob", 5); // il a raté les séq. 1-5 EN LIVE, mais son snapshot les contient
  }

  if (e.sequence === 8) {
    console.log("Chloé débarque en plein match :");
    chloe = connect("Chloé", 8); // snapshot jusqu'à 8, puis live à partir de 9
  }
}

// --- LA PREUVE ---
console.log("\n--- État final ---");
console.log(`Serveur : ${score(serverState)}`);
console.log(`Alice   : ${score(alice.state)}   (connectée séq. 0, a tout suivi en live)`);
console.log(`Bob     : ${score(bob!.state)}   (connecté séq. 5, snapshot + live)`);
console.log(`Chloé   : ${score(chloe!.state)}   (connectée séq. 8, snapshot + live)`);
const memeEtat =
  JSON.stringify(alice.state) === JSON.stringify(bob!.state) &&
  JSON.stringify(alice.state) === JSON.stringify(chloe!.state);
console.log(`\nAlice, Bob et Chloé ont-ils exactement le même état ? -> ${memeEtat}`);