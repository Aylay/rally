// engine.ts — LE CERVEAU.
import type { GameEvent, EventType, MatchState } from "./events.js";

// Tout type ABSENT d'ici = 0 point => NEUTRE PAR DÉFAUT.
const POINTS: Partial<Record<EventType, number>> = {
  shot_2pts: 2,
  shot_3pts: 3,
  free_throw: 1,
};

// Un état vierge, point de départ de tout calcul.
export function blankState(matchId: string): MatchState {
  return {
    matchId,
    scoreByTeam: {},
    pointsByPlayer: {},
    period: 0,
    gameClock: "00:00",
    status: "scheduled",
    lastSequence: 0,
  };
}

/**
 * LA BRIQUE ÉLÉMENTAIRE : applique UN SEUL événement à un état (le mute sur place).
 * - Le snapshot l'appelle en boucle (replier tout le flux).
 * - Le live l'appelle une fois par battement (le nouvel événement).
 * Même cœur, deux usages.
 */
export function applyEvent(state: MatchState, e: GameEvent): void {
  state.period = e.period;
  state.gameClock = e.gameClock;
  state.lastSequence = e.sequence;

  if (e.type === "game_start") state.status = "playing";
  if (e.type === "game_end") state.status = "finished";

  const pts = POINTS[e.type] ?? 0;
  if (pts > 0 && e.teamId) {
    state.scoreByTeam[e.teamId] = (state.scoreByTeam[e.teamId] ?? 0) + pts;
    if (e.playerId) {
      state.pointsByPlayer[e.playerId] = (state.pointsByPlayer[e.playerId] ?? 0) + pts;
    }
  }
}

/**
 * LE SNAPSHOT : on part de zéro et on applique tout le flux jusqu'à uptoSequence.
 * = blankState + applyEvent en boucle. C'est tout.
 */
export function deriveState(
  events: GameEvent[],
  uptoSequence: number = Infinity,
): MatchState {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const state = blankState(ordered[0]?.matchId ?? "");
  for (const e of ordered) {
    if (e.sequence > uptoSequence) break;
    applyEvent(state, e);
  }
  return state;
}