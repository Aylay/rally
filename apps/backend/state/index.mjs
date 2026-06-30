// Rally — endpoint public (GET) qui publie l'anchor de base.
// Le client le récupère UNE fois au chargement, puis dérive tout en local (loop modulo).
// On renvoie aussi serverNow → le client calcule son offset (calage d'horloge) pour que
// « même instant » tienne malgré la dérive de sa montre. Lecture seule (DynamoDBReadPolicy).
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;
const PK = process.env.MATCH_PK;

export const handler = async () => {
  const { Item } = await ddb.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: PK } } }));
  if (!Item) return resp(503, { error: "anchor-not-ready" });

  return resp(200, {
    matchId: PK.replace("match#", ""),
    baseStartedAt: Number(Item.baseStartedAt.N),  // origine fixe du temps
    lastSequence: Number(Item.lastSequence.N),
    tickMs: Number(Item.tickMs.N),
    pauseMs: Number(Item.pauseMs.N),
    status: Item.status.S,
    serverNow: Date.now(),                          // pour le calage d'horloge client
  });
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}
