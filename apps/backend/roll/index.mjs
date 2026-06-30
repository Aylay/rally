// Rally — concierge de cycle (Modèle B, time-anchor).
// On NE tick PAS. On regarde si le cycle est fini ; si oui, on en démarre un nouveau.
// Le SDK AWS v3 est fourni par le runtime nodejs22.x → aucun node_modules à packager.
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;
const PK = process.env.MATCH_PK;
const SEED = {
  lastSequence: Number(process.env.LAST_SEQUENCE ?? 73),
  tickMs: Number(process.env.TICK_MS ?? 1500),
  pauseMs: Number(process.env.PAUSE_MS ?? 15000),
};

export const handler = async () => {
  const now = Date.now();
  const { Item } = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: PK } } }));

  // Pas encore d'anchor → on amorce le tout premier cycle.
  if (!Item) {
    await startCycle(now, SEED, null);
    console.log(JSON.stringify({ action: "seeded", startedAt: now }));
    return;
  }

  const cfg = {
    lastSequence: Number(Item.lastSequence.N),
    tickMs: Number(Item.tickMs.N),
    pauseMs: Number(Item.pauseMs.N),
  };
  const startedAt = Number(Item.cycleStartedAt.N);
  const cycleMs = cfg.lastSequence * cfg.tickMs + cfg.pauseMs; // jeu + pause
  const elapsed = now - startedAt;

  if (elapsed >= cycleMs) {
    await startCycle(now, cfg, startedAt); // roll, conditionnel sur l'ancien startedAt
    console.log(JSON.stringify({ action: "rolled", from: startedAt, to: now }));
  } else {
    console.log(JSON.stringify({ action: "noop", elapsedMs: elapsed, remainingMs: cycleMs - elapsed }));
  }
};

async function startCycle(now, cfg, expectedStartedAt) {
  const cmd = {
    TableName: TABLE,
    Item: {
      pk: { S: PK },
      cycleId: { S: `cycle_${now}` },          // recette d'id = timestamp (tranche l'item ouvert du carnet)
      cycleStartedAt: { N: String(now) },
      status: { S: "running" },
      lastSequence: { N: String(cfg.lastSequence) },
      tickMs: { N: String(cfg.tickMs) },
      pauseMs: { N: String(cfg.pauseMs) },
    },
  };
  // Idempotence : on ne reboucle QUE si personne ne l'a déjà fait (anti double-roll).
  if (expectedStartedAt === null) {
    cmd.ConditionExpression = "attribute_not_exists(pk)";                       // amorçage
  } else {
    cmd.ConditionExpression = "cycleStartedAt = :old";                          // roll
    cmd.ExpressionAttributeValues = { ":old": { N: String(expectedStartedAt) } };
  }
  try {
    await ddb.send(new PutItemCommand(cmd));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      console.log(JSON.stringify({ action: "skip", reason: "already-done" }));
    } else throw e;
  }
}
