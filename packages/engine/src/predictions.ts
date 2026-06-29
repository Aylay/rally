// predictions.ts — logique de prédiction (partie réutilisable du moteur).
import type { MatchState } from "./events.js";

export interface Prediction {
  id: string;
  question: string;
  options: string[];               // les réponses possibles (teamId OU playerId)
  resolveAtSequence: number;       // la séquence où la réponse devient connue
  resolveOn: "team" | "player";    // sur QUELLE dimension on tranche
}

export interface Bet {
  userId: string;
  predictionId: string;
  choice: string;
}

/**
 * Renvoie l'option gagnante, DÉRIVÉE de l'état au moment de la résolution.
 * resolveOn choisit le décompte : score par équipe OU points par joueur.
 * On parcourt les options déclarées (pas les clés du décompte) avec 0 par défaut.
 */
export function resolve(prediction: Prediction, state: MatchState): string {
  const tally = prediction.resolveOn === "player" ? state.pointsByPlayer : state.scoreByTeam;
  const [winner] = prediction.options
    .map((opt) => [opt, tally[opt] ?? 0] as const)
    .reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return winner;
}