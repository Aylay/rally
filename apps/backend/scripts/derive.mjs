// Lecteur : dérive cycle + séquence depuis l'anchor de BASE (modulo). Zéro stockage de l'état.
import { execSync } from "node:child_process";

const REGION = process.env.AWS_REGION || "eu-west-3";
const TABLE = process.env.RALLY_TABLE || "RallyState";
const PK = "match#fra_aus_2019";

let item;
try {
  const raw = execSync(
    `aws dynamodb get-item --region ${REGION} --table-name ${TABLE} ` +
    `--key '{"pk":{"S":"${PK}"}}' --output json`,
    { encoding: "utf8" }
  );
  item = JSON.parse(raw).Item;
} catch (e) { console.error("get-item:", e.message.split("\n")[0]); process.exit(1); }
if (!item) { console.log("Pas d'anchor (invoke la Lambda une fois pour l'amorcer)."); process.exit(0); }

const baseStartedAt = Number(item.baseStartedAt.N);
const tickMs  = Number(item.tickMs.N);
const lastSeq = Number(item.lastSequence.N);
const pauseMs = Number(item.pauseMs.N);

const playMs  = lastSeq * tickMs;
const cycleMs = playMs + pauseMs;

const total = Date.now() - baseStartedAt;   // temps écoulé depuis l'origine fixe
const cycleIndex = Math.floor(total / cycleMs);  // quel tour de boucle (dérivé)
const within = total % cycleMs;                  // où on en est DANS ce tour

let phase, seq;
if (within < playMs) { phase = "PLAYING";       seq = Math.min(Math.floor(within / tickMs) + 1, lastSeq); }
else                 { phase = "PAUSE (final)"; seq = lastSeq; }

const bar = "█".repeat(Math.round((seq / lastSeq) * 24)).padEnd(24, "·");
console.log(`cycle #${cycleIndex}  [${bar}]  seq ${String(seq).padStart(2)}/${lastSeq}  ${phase}  (loop +${(within/1000).toFixed(0)}s)`);
