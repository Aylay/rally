// Lecteur : dérive la séquence courante depuis l'anchor (zéro stockage de la séquence).
// Pas de SDK à installer : on passe par l'AWS CLI (déjà configuré).
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
} catch (e) {
  console.error("Erreur get-item :", e.message.split("\n")[0]);
  process.exit(1);
}
if (!item) { console.log("Pas encore d'anchor (attends le 1er tick EventBridge, ou amorce via invoke)."); process.exit(0); }

const startedAt = Number(item.cycleStartedAt.N);
const tickMs = Number(item.tickMs.N);
const lastSeq = Number(item.lastSequence.N);
const pauseMs = Number(item.pauseMs.N);
const cycleId = item.cycleId.S;

const elapsed = Date.now() - startedAt;
const playMs = lastSeq * tickMs;

let phase, seq;
if (elapsed < playMs)            { phase = "PLAYING";            seq = Math.min(Math.floor(elapsed / tickMs) + 1, lastSeq); }
else if (elapsed < playMs + pauseMs) { phase = "PAUSE (final)";  seq = lastSeq; }
else                             { phase = "CYCLE OVER (waiting roll)"; seq = lastSeq; }

const bar = "█".repeat(Math.round((seq / lastSeq) * 24)).padEnd(24, "·");
console.log(`${cycleId}  [${bar}]  seq ${String(seq).padStart(2)}/${lastSeq}  ${phase}  (+${(elapsed/1000).toFixed(0)}s)`);
