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
export function resolve(prediction: Prediction, state: MatchState): string[] {
  const tally = prediction.resolveOn === "player" ? state.pointsByPlayer : state.scoreByTeam;
  // on ne regarde QUE les options déclarées (?? 0), jamais les clés du décompte
  const scored = prediction.options.map((o) => ({ option: o, value: tally[o] ?? 0 }));
  const max = Math.max(...scored.map((s) => s.value));
  // ÉGALITÉ : toutes les options à `max` gagnent
  return scored.filter((s) => s.value === max).map((s) => s.option);
}
// un pari gagne si son choix est dans l'ensemble gagnant
export const isWinningChoice = (p: Prediction, s: MatchState, choice: string) =>
  resolve(p, s).includes(choice);