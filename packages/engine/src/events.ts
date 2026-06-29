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

// Rally — seed events: France vs Australia, FIBA World Cup 2019 bronze medal game (France won 67–59).
// Play-by-play complet, attribué à la vidéo. Quart-temps vérifiés : 16-11 / 30-21 / 46-42 / 59-67.
// Totaux officiels recoupés : De Colo 19, Ingles 17, Mills 15.
// >>> Colle ce tableau À LA PLACE de ton ancien SEED_EVENTS dans packages/engine/src/events.ts.
export const SEED_EVENTS: GameEvent[] = [
  { matchId: "fra_aus_2019", sequence: 1, type: "game_start", period: 1, gameClock: "10:00", descriptionEn: "Tip-off: France vs Australia — FIBA World Cup 2019 bronze medal game.", descriptionFr: "Coup d'envoi : France–Australie, petite finale de la Coupe du Monde FIBA 2019." },
  { matchId: "fra_aus_2019", sequence: 2, type: "period_start", period: 1, gameClock: "10:00", descriptionEn: "Start of Q1.", descriptionFr: "Début du Q1." },
  { matchId: "fra_aus_2019", sequence: 3, type: "shot_2pts", period: 1, gameClock: "08:35", teamId: "team_aus", playerId: "player_kay", descriptionEn: "Kay — 2 pts", descriptionFr: "Kay — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 4, type: "shot_3pts", period: 1, gameClock: "08:02", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — 3 pts", descriptionFr: "Mills — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 5, type: "shot_2pts", period: 1, gameClock: "07:45", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — 2 pts", descriptionFr: "Fournier — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 6, type: "shot_2pts", period: 1, gameClock: "07:13", teamId: "team_fra", playerId: "player_ntilikina", descriptionEn: "Ntilikina — 2 pts", descriptionFr: "Ntilikina — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 7, type: "shot_2pts", period: 1, gameClock: "06:56", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — 2 pts", descriptionFr: "Mills — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 8, type: "free_throw", period: 1, gameClock: "05:31", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — free throw", descriptionFr: "Mills — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 9, type: "shot_2pts", period: 1, gameClock: "04:41", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — 2 pts", descriptionFr: "Mills — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 10, type: "shot_2pts", period: 1, gameClock: "03:53", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — 2 pts", descriptionFr: "De Colo — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 11, type: "shot_3pts", period: 1, gameClock: "03:37", teamId: "team_aus", playerId: "player_baynes", descriptionEn: "Baynes — 3 pts", descriptionFr: "Baynes — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 12, type: "shot_2pts", period: 1, gameClock: "03:13", teamId: "team_fra", playerId: "player_poirier", descriptionEn: "Poirier — 2 pts", descriptionFr: "Poirier — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 13, type: "free_throw", period: 1, gameClock: "01:29", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — free throw", descriptionFr: "Ingles — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 14, type: "shot_2pts", period: 1, gameClock: "00:13", teamId: "team_aus", playerId: "player_bogut", descriptionEn: "Bogut — 2 pts", descriptionFr: "Bogut — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 15, type: "shot_3pts", period: 1, gameClock: "00:01", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — 3 pts", descriptionFr: "De Colo — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 16, type: "period_end", period: 1, gameClock: "00:00", descriptionEn: "End of Q1. Australia 16, France 11.", descriptionFr: "Fin du Q1. Australie 16, France 11." },
  { matchId: "fra_aus_2019", sequence: 17, type: "period_start", period: 2, gameClock: "10:00", descriptionEn: "Start of Q2.", descriptionFr: "Début du Q2." },
  { matchId: "fra_aus_2019", sequence: 18, type: "shot_3pts", period: 2, gameClock: "08:48", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 3 pts", descriptionFr: "Ingles — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 19, type: "shot_2pts", period: 2, gameClock: "08:21", teamId: "team_fra", playerId: "player_poirier", descriptionEn: "Poirier — 2 pts", descriptionFr: "Poirier — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 20, type: "shot_2pts", period: 2, gameClock: "06:33", teamId: "team_fra", playerId: "player_labeyrie", descriptionEn: "Labeyrie — dunk", descriptionFr: "Labeyrie — dunk" },
  { matchId: "fra_aus_2019", sequence: 21, type: "shot_2pts", period: 2, gameClock: "06:15", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 2 pts", descriptionFr: "Ingles — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 22, type: "free_throw", period: 2, gameClock: "05:37", teamId: "team_aus", playerId: "player_bogut", descriptionEn: "Bogut — free throw", descriptionFr: "Bogut — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 23, type: "free_throw", period: 2, gameClock: "04:46", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — free throw", descriptionFr: "Fournier — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 24, type: "free_throw", period: 2, gameClock: "04:46", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — free throw", descriptionFr: "Fournier — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 25, type: "free_throw", period: 2, gameClock: "04:46", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — free throw", descriptionFr: "Fournier — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 26, type: "shot_2pts", period: 2, gameClock: "03:34", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 2 pts", descriptionFr: "Ingles — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 27, type: "shot_2pts", period: 2, gameClock: "02:57", teamId: "team_aus", playerId: "player_landale", descriptionEn: "Landale — 2 pts", descriptionFr: "Landale — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 28, type: "shot_3pts", period: 2, gameClock: "02:42", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — 3 pts", descriptionFr: "Fournier — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 29, type: "shot_2pts", period: 2, gameClock: "02:13", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 2 pts", descriptionFr: "Ingles — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 30, type: "shot_2pts", period: 2, gameClock: "00:25", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 2 pts", descriptionFr: "Ingles — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 31, type: "period_end", period: 2, gameClock: "00:00", descriptionEn: "End of Q2. Australia 30, France 21.", descriptionFr: "Fin du Q2. Australie 30, France 21." },
  { matchId: "fra_aus_2019", sequence: 32, type: "period_start", period: 3, gameClock: "10:00", descriptionEn: "Start of Q3.", descriptionFr: "Début du Q3." },
  { matchId: "fra_aus_2019", sequence: 33, type: "shot_2pts", period: 3, gameClock: "09:21", teamId: "team_aus", playerId: "player_kay", descriptionEn: "Kay — 2 pts (and-one)", descriptionFr: "Kay — 2 pts (panier + faute)" },
  { matchId: "fra_aus_2019", sequence: 34, type: "free_throw", period: 3, gameClock: "09:21", teamId: "team_aus", playerId: "player_kay", descriptionEn: "Kay — free throw", descriptionFr: "Kay — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 35, type: "shot_2pts", period: 3, gameClock: "09:10", teamId: "team_fra", playerId: "player_batum", descriptionEn: "Batum — 2 pts", descriptionFr: "Batum — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 36, type: "shot_2pts", period: 3, gameClock: "08:46", teamId: "team_aus", playerId: "player_dellavedova", descriptionEn: "Dellavedova — 2 pts", descriptionFr: "Dellavedova — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 37, type: "shot_2pts", period: 3, gameClock: "07:50", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — 2 pts", descriptionFr: "Ingles — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 38, type: "free_throw", period: 3, gameClock: "07:50", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — free throw", descriptionFr: "Ingles — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 39, type: "shot_2pts", period: 3, gameClock: "07:02", teamId: "team_fra", playerId: "player_batum", descriptionEn: "Batum — dunk", descriptionFr: "Batum — dunk" },
  { matchId: "fra_aus_2019", sequence: 40, type: "shot_2pts", period: 3, gameClock: "06:25", teamId: "team_aus", playerId: "player_landale", descriptionEn: "Landale — 2 pts", descriptionFr: "Landale — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 41, type: "shot_3pts", period: 3, gameClock: "06:09", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — 3 pts", descriptionFr: "Fournier — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 42, type: "shot_2pts", period: 3, gameClock: "05:20", teamId: "team_aus", playerId: "player_baynes", descriptionEn: "Baynes — 2 pts", descriptionFr: "Baynes — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 43, type: "free_throw", period: 3, gameClock: "04:55", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — free throw", descriptionFr: "Fournier — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 44, type: "shot_3pts", period: 3, gameClock: "04:46", teamId: "team_fra", playerId: "player_batum", descriptionEn: "Batum — 3 pts", descriptionFr: "Batum — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 45, type: "shot_2pts", period: 3, gameClock: "04:18", teamId: "team_fra", playerId: "player_poirier", descriptionEn: "Poirier — dunk", descriptionFr: "Poirier — dunk" },
  { matchId: "fra_aus_2019", sequence: 46, type: "shot_2pts", period: 3, gameClock: "03:51", teamId: "team_aus", playerId: "player_ingles", descriptionEn: "Ingles — layup", descriptionFr: "Ingles — lay-up" },
  { matchId: "fra_aus_2019", sequence: 47, type: "shot_2pts", period: 3, gameClock: "03:31", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — 2 pts", descriptionFr: "De Colo — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 48, type: "shot_2pts", period: 3, gameClock: "03:10", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — layup", descriptionFr: "De Colo — lay-up" },
  { matchId: "fra_aus_2019", sequence: 49, type: "shot_2pts", period: 3, gameClock: "02:30", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — floater", descriptionFr: "Fournier — floater" },
  { matchId: "fra_aus_2019", sequence: 50, type: "shot_2pts", period: 3, gameClock: "01:31", teamId: "team_fra", playerId: "player_poirier", descriptionEn: "Poirier — dunk", descriptionFr: "Poirier — dunk" },
  { matchId: "fra_aus_2019", sequence: 51, type: "shot_2pts", period: 3, gameClock: "00:39", teamId: "team_aus", playerId: "player_dellavedova", descriptionEn: "Dellavedova — 2 pts", descriptionFr: "Dellavedova — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 52, type: "period_end", period: 3, gameClock: "00:00", descriptionEn: "End of Q3. Australia 46, France 42.", descriptionFr: "Fin du Q3. Australie 46, France 42." },
  { matchId: "fra_aus_2019", sequence: 53, type: "period_start", period: 4, gameClock: "10:00", descriptionEn: "Start of Q4.", descriptionFr: "Début du Q4." },
  { matchId: "fra_aus_2019", sequence: 54, type: "shot_3pts", period: 4, gameClock: "09:50", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — 3 pts", descriptionFr: "De Colo — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 55, type: "free_throw", period: 4, gameClock: "09:01", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — free throw", descriptionFr: "De Colo — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 56, type: "free_throw", period: 4, gameClock: "09:01", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — free throw", descriptionFr: "De Colo — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 57, type: "shot_3pts", period: 4, gameClock: "08:03", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — 3 pts", descriptionFr: "De Colo — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 58, type: "shot_2pts", period: 4, gameClock: "07:44", teamId: "team_aus", playerId: "player_kay", descriptionEn: "Kay — layup", descriptionFr: "Kay — lay-up" },
  { matchId: "fra_aus_2019", sequence: 59, type: "shot_2pts", period: 4, gameClock: "06:57", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — 2 pts", descriptionFr: "Mills — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 60, type: "shot_2pts", period: 4, gameClock: "06:16", teamId: "team_aus", playerId: "player_bogut", descriptionEn: "Bogut — floater", descriptionFr: "Bogut — floater" },
  { matchId: "fra_aus_2019", sequence: 61, type: "shot_3pts", period: 4, gameClock: "05:55", teamId: "team_fra", playerId: "player_albicy", descriptionEn: "Albicy — 3 pts", descriptionFr: "Albicy — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 62, type: "shot_2pts", period: 4, gameClock: "05:29", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — 2 pts", descriptionFr: "Mills — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 63, type: "shot_2pts", period: 4, gameClock: "04:06", teamId: "team_fra", playerId: "player_fournier", descriptionEn: "Fournier — 2 pts", descriptionFr: "Fournier — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 64, type: "shot_2pts", period: 4, gameClock: "03:50", teamId: "team_aus", playerId: "player_kay", descriptionEn: "Kay — tip-in", descriptionFr: "Kay — claquette" },
  { matchId: "fra_aus_2019", sequence: 65, type: "shot_3pts", period: 4, gameClock: "03:30", teamId: "team_fra", playerId: "player_albicy", descriptionEn: "Albicy — 3 pts", descriptionFr: "Albicy — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 66, type: "shot_2pts", period: 4, gameClock: "02:07", teamId: "team_fra", playerId: "player_gobert", descriptionEn: "Gobert — 2 pts", descriptionFr: "Gobert — 2 pts" },
  { matchId: "fra_aus_2019", sequence: 67, type: "shot_3pts", period: 4, gameClock: "01:06", teamId: "team_fra", playerId: "player_albicy", descriptionEn: "Albicy — 3 pts", descriptionFr: "Albicy — 3 pts" },
  { matchId: "fra_aus_2019", sequence: 68, type: "free_throw", period: 4, gameClock: "00:47", teamId: "team_fra", playerId: "player_batum", descriptionEn: "Batum — free throw", descriptionFr: "Batum — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 69, type: "shot_3pts", period: 4, gameClock: "00:38", teamId: "team_aus", playerId: "player_mills", descriptionEn: "Mills — three from the corner", descriptionFr: "Mills — 3 pts du corner" },
  { matchId: "fra_aus_2019", sequence: 70, type: "shot_2pts", period: 4, gameClock: "00:36", teamId: "team_fra", playerId: "player_decolo", descriptionEn: "De Colo — layup", descriptionFr: "De Colo — lay-up" },
  { matchId: "fra_aus_2019", sequence: 71, type: "free_throw", period: 4, gameClock: "00:25", teamId: "team_fra", playerId: "player_batum", descriptionEn: "Batum — free throw", descriptionFr: "Batum — lancer franc" },
  { matchId: "fra_aus_2019", sequence: 72, type: "period_end", period: 4, gameClock: "00:00", descriptionEn: "End of Q4. Australia 59, France 67.", descriptionFr: "Fin du Q4. Australie 59, France 67." },
  { matchId: "fra_aus_2019", sequence: 73, type: "game_end", period: 4, gameClock: "00:00", descriptionEn: "Final: France 67, Australia 59. France win bronze.", descriptionFr: "Final : France 67, Australie 59. Le bronze pour la France." },
];