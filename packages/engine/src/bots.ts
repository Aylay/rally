// bots.ts — les adversaires CPU, DÉTERMINISTES. Même (manche, prédiction, bot) → même pick,
// sur CHAQUE client, sans aucune communication. C'est « on dérive, on ne duplique pas »
// appliqué aux adversaires : le leaderboard partagé ne peut plus diverger.
export interface Bot { id: string; name: string; skill: number; }

export const BOTS: Bot[] = [
  { id: "cpu_chalk", name: "Chalk", skill: 0.85 }, // suit le favori au lock
  { id: "cpu_flip",  name: "Flip",  skill: 0.55 }, // pile ou face
  { id: "cpu_rebel", name: "Rebel", skill: 0.30 }, // contrarian
];

// PRNG déterministe (xmur3 pour hacher la graine → mulberry32 pour la suite de floats).
// Que des opérations entières 32 bits → reproductible sur n'importe quel moteur JS.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeRng(seed: string): () => number {
  return mulberry32(xmur3(seed)());
}

/**
 * Le pick d'un bot, DÉRIVÉ (zéro Math.random). Modèle INCHANGÉ : au lock on regarde
 * favori/outsider selon le décompte à cet instant, et le bot suit le favori avec une
 * probabilité = son skill. Seule la source d'aléa change → une graine sur (manche,
 * prédiction, bot) → identique partout, sans échanger un octet.
 */
export function botPick(
  cycleIndex: number,
  predictionId: string,
  bot: Bot,
  options: string[],
  tallyAtLock: Record<string, number>,
): string {
  const rng = makeRng(`${cycleIndex}:${predictionId}:${bot.id}`);
  const ranked = [...options].sort((a, b) => (tallyAtLock[b] ?? 0) - (tallyAtLock[a] ?? 0));
  const fav = ranked[0];
  const und = ranked[ranked.length - 1];
  const noInfo = (tallyAtLock[fav] ?? 0) === (tallyAtLock[und] ?? 0); // rien pour trancher → hasard (semé)
  if (noInfo) return options[Math.floor(rng() * options.length)];
  return rng() < bot.skill ? fav : und;
}