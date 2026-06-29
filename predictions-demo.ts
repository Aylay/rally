// predictions-demo.ts — LE JEU : prédiction sur un moment-clé -> résolution -> leaderboard.
// La bonne réponse n'est JAMAIS stockée : elle se DÉRIVE de l'état du match au
// moment de la résolution (le snapshot). Exactement comme le score.
import { SEED_EVENTS } from "./events.js";
import { blankState, applyEvent } from "./engine.js";
import type { GameEvent, MatchState } from "./events.js";

// --- modèle ---
interface Prediction {
  id: string;
  question: string;
  options: string[];               // les réponses possibles (teamId OU playerId)
  resolveAtSequence: number;       // la séquence où la réponse devient connue
  resolveOn: "team" | "player";    // sur QUELLE dimension on tranche
}
interface Bet {
  userId: string;
  predictionId: string;
  choice: string;
}

const script: GameEvent[] = [...SEED_EVENTS].sort((a, b) => a.sequence - b.sequence);

// Donnée de référence : les ids viennent d'ICI, on ne les retape jamais ailleurs.
// (En vrai : les tables `teams` / `players`. Ici, deux petites maps.)
const TEAM: Record<string, string> = { team_fra: "France", team_aus: "Australie" };
const PLAYER: Record<string, string> = {
  player_batum: "Nicolas Batum",
  player_mills: "Patty Mills",
  player_fournier: "Evan Fournier",
  player_gobert: "Rudy Gobert",
  player_ingles: "Joe Ingles",
  player_baynes: "Aron Baynes",
};
const label = (id: string) => TEAM[id] ?? PLAYER[id] ?? id;
const POINTS_CORRECT = 10;

const predictions: Prediction[] = [
  {
    id: "pred_q1_leader",
    question: "Qui mène à la fin du 1er quart-temps ?",
    options: ["team_fra", "team_aus"],
    resolveAtSequence: 9,
    resolveOn: "team",
  },
  {
    id: "pred_q1_points_leader",
    question: "Quel joueur aura le plus de points à la fin du 1er quart-temps ?",
    options: ["player_batum", "player_mills", "player_fournier", "player_gobert", "player_ingles"],
    resolveAtSequence: 9,
    resolveOn: "player",
  },
];

// Des paris posés AVANT la résolution. CPU = bot, assumé et étiqueté.
const bets: Bet[] = [
  { userId: "Alice",  predictionId: "pred_q1_leader", choice: "team_fra" },
  { userId: "Bob",    predictionId: "pred_q1_leader", choice: "team_aus" },
  { userId: "Chloé",  predictionId: "pred_q1_leader", choice: "team_fra" },
  { userId: "CPU 🤖", predictionId: "pred_q1_leader", choice: "team_aus" },
  { userId: "Alice",  predictionId: "pred_q1_points_leader", choice: "player_batum" },
  { userId: "Bob",    predictionId: "pred_q1_points_leader", choice: "player_mills" },
  { userId: "Chloé",  predictionId: "pred_q1_points_leader", choice: "player_ingles" },
  { userId: "CPU 🤖", predictionId: "pred_q1_points_leader", choice: "player_gobert" },
];

/**
 * LE RÉSOLVEUR : renvoie l'option gagnante, DÉRIVÉE de l'état au moment T.
 * resolveOn choisit le décompte : score par équipe OU points par joueur.
 * On parcourt les options déclarées (pas les clés du décompte) avec 0 par défaut.
 */
function resolve(prediction: Prediction, state: MatchState): string {
  const tally = prediction.resolveOn === "player" ? state.pointsByPlayer : state.scoreByTeam;
  const [winner] = prediction.options
    .map((opt) => [opt, tally[opt] ?? 0] as const)
    .reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return winner;
}

// --- la boucle : le match avance ; à la séquence de résolution, on tranche ---
const serverState = blankState("fra_aus_2019");
const leaderboard: Record<string, number> = {};
for (const b of bets) leaderboard[b.userId] ??= 0;

for (const e of script) {
  applyEvent(serverState, e); // le serveur tient l'état à jour, cran par cran

  for (const pred of predictions.filter((p) => p.resolveAtSequence === e.sequence)) {
    const winner = resolve(pred, serverState);
    console.log(`\nRésolution — « ${pred.question} »`);
    const tally = pred.resolveOn === "player" ? serverState.pointsByPlayer : serverState.scoreByTeam;
    console.log("  décompte : " + pred.options.map((o) => `${label(o)} ${tally[o] ?? 0}`).join(", "));
    console.log(`  bonne réponse (dérivée) : ${label(winner)}`);

    for (const bet of bets.filter((b) => b.predictionId === pred.id)) {
      const correct = bet.choice === winner;
      if (correct) leaderboard[bet.userId] += POINTS_CORRECT;
      console.log(`    ${bet.userId.padEnd(8)} a parié ${label(bet.choice).padEnd(14)} ${correct ? `✅ +${POINTS_CORRECT}` : "❌ +0"}`);
    }
  }
}

// --- leaderboard (de cette manche : repart à zéro au prochain cycleId) ---
console.log("\n--- Leaderboard ---");
Object.entries(leaderboard)
  .sort((a, b) => b[1] - a[1])
  .forEach(([user, pts], i) => console.log(`  ${i + 1}. ${user.padEnd(8)} ${pts} pts`));