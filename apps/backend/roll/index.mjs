// Rally — gardien de l'anchor de base (Modèle B, loop DÉRIVÉE).
// La boucle est entièrement dérivée du temps côté lecteur/client (modulo) → rebouclage
// instantané, zéro trou. Le serveur ne "tick" ni ne "roll" plus : il garantit juste que
// l'anchor de BASE existe. baseStartedAt est FIXE : posé une fois, ne bouge plus jamais.
// (En V2, cette même Lambda + EventBridge récupèrent leur vrai job : la transition de match,
//  qui elle n'est PAS dérivable du temps.)
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
  const { Item } = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: PK } } }));
  if (Item) {
    console.log(JSON.stringify({ action: "ok", baseStartedAt: Number(Item.baseStartedAt?.N) }));
    return; // anchor présent → rien à faire, la boucle se dérive toute seule
  }
  // Anchor absent → on amorce une base FIXE (le cycle 0 démarre maintenant).
  const now = Date.now();
  try {
    await ddb.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        pk: { S: PK },
        baseStartedAt: { N: String(now) },   // FIXE : l'origine du temps, immuable
        status: { S: "running" },
        lastSequence: { N: String(SEED.lastSequence) },
        tickMs: { N: String(SEED.tickMs) },
        pauseMs: { N: String(SEED.pauseMs) },
      },
      ConditionExpression: "attribute_not_exists(pk)", // idempotent : ne réamorce jamais par-dessus
    }));
    console.log(JSON.stringify({ action: "seeded", baseStartedAt: now }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") console.log(JSON.stringify({ action: "raced-ok" }));
    else throw e;
  }
};
