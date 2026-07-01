// leaderboard.ts — le classement partagé, DÉRIVÉ. Entrées : la manche, les picks humains
// (relayés par le WebSocket) et le flux d'events (figé). Les bots se dérivent, la bonne
// réponse se dérive du snapshot. Mêmes entrées → même classement sur CHAQUE client.
import type { GameEvent, MatchState } from "./events";
import { deriveState } from "./engine";
import { resolve } from "./predictions";
import { BOTS, botPick } from "./bots";

// Forme minimale dont le classement a besoin (le front a une Prediction étendue avec open/lock).
export interface ScorablePrediction {
  id: string;
  options: string[];
  lockAtSequence: number;
  resolveAtSequence: number;
  resolveOn: "team" | "player";
}

export interface Standing { rank: number; id: string; name: string; isBot: boolean; points: number; }

const tallyOf = (s: MatchState, on: "team" | "player") =>
  on === "player" ? s.pointsByPlayer : s.scoreByTeam;

/**
 * Classement de la manche `cycleIndex` à l'instant `seq`.
 * - On ne compte QUE les prédictions déjà résolues (seq >= resolveAtSequence).
 * - Humains : pick pris dans `humanPicks` (relayé par le WS). Bots : pick DÉRIVÉ (botPick).
 * - Bonne réponse : `resolve` sur le snapshot à la résolution (jamais stockée).
 * - Ex æquo : même rang (compétition standard 1224). Départage d'affichage par pseudo,
 *   en comparaison par UNITÉS DE CODE (pas localeCompare) → déterministe, identique partout.
 */
export function computeStandings(opts: {
  cycleIndex: number;
  seq: number;
  events: GameEvent[];
  predictions: ScorablePrediction[];
  humanPicks: Record<string, Record<string, string>>; // pseudo → { predictionId → choice }
  pointsPerHit?: number;
}): Standing[] {
  const { cycleIndex, seq, events, predictions, humanPicks, pointsPerHit = 10 } = opts;

  const humans = Object.keys(humanPicks);
  const points: Record<string, number> = {};
  for (const h of humans) points[h] = 0;
  for (const b of BOTS) points[b.id] = 0;

  for (const p of predictions) {
    if (seq < p.resolveAtSequence) continue; // pas encore résolue → aucun point
    // Règle d'égalité du moteur : resolve() renvoie string[] (tous les ex æquo gagnent).
    const winners = resolve(
      { id: p.id, question: "", options: p.options, resolveAtSequence: p.resolveAtSequence, resolveOn: p.resolveOn },
      deriveState(events, p.resolveAtSequence),
    );
    const tallyAtLock = tallyOf(deriveState(events, p.lockAtSequence), p.resolveOn);

    for (const h of humans) {
      const pick = humanPicks[h]?.[p.id];
      if (pick != null && winners.includes(pick)) points[h] += pointsPerHit;
    }
    for (const b of BOTS) {
      if (winners.includes(botPick(cycleIndex, p.id, b, p.options, tallyAtLock))) points[b.id] += pointsPerHit;
    }
  }

  const rows: Standing[] = [
    ...humans.map((h) => ({ rank: 0, id: h, name: h, isBot: false, points: points[h] })),
    ...BOTS.map((b) => ({ rank: 0, id: b.id, name: b.name, isBot: true, points: points[b.id] })),
  ];

  // tri : points décroissants, puis pseudo par unités de code (déterministe, locale-indépendant).
  rows.sort((a, b) => b.points - a.points || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  // rang compétition standard (1224) : ex æquo = même rang, on saute les suivants.
  rows.forEach((row, i) => {
    row.rank = i > 0 && row.points === rows[i - 1].points ? rows[i - 1].rank : i + 1;
  });

  return rows;
}