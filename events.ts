// events.ts — les TYPES + la donnée de référence (le script figé du match).

export type EventType =
  | "game_start"
  | "period_start"
  | "shot_2pts"
  | "shot_3pts"
  | "free_throw"
  | "period_end"
  | "game_end";

export interface GameEvent {
  matchId: string;     // clé de partition DynamoDB — "de quel script"
  sequence: number;    // clé de tri DynamoDB — l'ordre dans le match
  type: EventType;     // pilote toute la logique
  period: number;      // quart-temps
  gameClock: string;   // AFFICHAGE uniquement, jamais pour l'ordre
  teamId?: string;     // optionnel selon le type
  playerId?: string;   // optionnel selon le type
  descriptionFr?: string; // cosmétique
  descriptionEn?: string; // cosmétique
}

// L'état DÉRIVÉ. Jamais stocké comme vérité : recalculé en repliant le flux.
export interface MatchState {
  matchId: string;
  scoreByTeam: Record<string, number>;
  pointsByPlayer: Record<string, number>;
  period: number;
  gameClock: string;
  status: "scheduled" | "playing" | "finished";
  lastSequence: number;
}

// ⚠️ TRANCHE D'AMORÇAGE SYNTHÉTIQUE.
// Les joueurs et les équipes sont réels (effectifs France/Australie 2019),
// mais l'enchaînement précis des tirs est ILLUSTRATIF, juste pour faire
// tourner le moteur. À REMPLACER par le vrai play-by-play FIBA quand on transcrira.
export const SEED_EVENTS: GameEvent[] = [
  { matchId: "fra_aus_2019",
    sequence: 1,
    type: "game_start",
    period: 1,
    gameClock: "10:00",
    descriptionFr: "Début du match : France vs Australie.",
    descriptionEn: "Game start: France vs Australia."
  }, {
    matchId: "fra_aus_2019",
    sequence: 2,
    type: "period_start",
    period: 1,
    gameClock: "10:00",
    descriptionFr: "Début du 1er quart-temps.",
    descriptionEn: "Start of Q1."
  }, {
    matchId: "fra_aus_2019",
    sequence: 3,
    type: "shot_2pts",
    period: 1,
    gameClock: "09:31",
    teamId: "team_aus",
    playerId: "player_mills",
    descriptionFr: "Patty Mills marque un 2 points.",
    descriptionEn: "Patty Mills scores a 2-pointer."
  }, {
    matchId: "fra_aus_2019",
    sequence: 4,
    type: "shot_3pts",
    period: 1,
    gameClock: "08:58",
    teamId: "team_fra",
    playerId: "player_fournier",
    descriptionFr: "Evan Fournier marque un 3 points.",
    descriptionEn: "Evan Fournier hits a 3-pointer."
  }, {
    matchId: "fra_aus_2019",
    sequence: 5,
    type: "shot_2pts",
    period: 1,
    gameClock: "08:30",
    teamId: "team_fra",
    playerId: "player_gobert",
    descriptionFr: "Rudy Gobert marque un 2 points sur un dunk.",
    descriptionEn: "Rudy Gobert scores a 2-pointer on a dunk."
  }, {
    matchId: "fra_aus_2019",
    sequence: 6,
    type: "free_throw",
    period: 1,
    gameClock: "07:42",
    teamId: "team_aus",
    playerId: "player_baynes",
    descriptionFr: "Aron Baynes marque un lancer-franc.",
    descriptionEn: "Aron Baynes makes a free throw."
  }, {
    matchId: "fra_aus_2019",
    sequence: 7,
    type: "shot_3pts",
    period: 1,
    gameClock: "06:30",
    teamId: "team_fra",
    playerId: "player_batum",
    descriptionFr: "Nicolas Batum marque un 3 points depuis le coin gauche.",
    descriptionEn: "Nicolas Batum makes a 3-pointer from the left corner."
  }, {
    matchId: "fra_aus_2019",
    sequence: 8,
    type: "shot_2pts",
    period: 1,
    gameClock: "05:55",
    teamId: "team_aus",
    playerId: "player_ingles",
    descriptionFr: "Joe Ingles marque un 2 points.",
    descriptionEn: "Joe Ingles scores a 2-pointer."
  }, {
    matchId: "fra_aus_2019",
    sequence: 9,
    type: "period_end",
    period: 1,
    gameClock: "00:00",
    descriptionFr: "Fin du 1er quart-temps.",
    descriptionEn: "End of Q1."
  },
];
