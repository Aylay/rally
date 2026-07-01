// Rally — WebSocket (sous-tranche A) : présence live + unicité du pseudo.
// UNE seule Lambda pour toutes les routes (switch sur routeKey). Modèle RELAY :
// le serveur ne porte que le NON-dérivable (la présence). Le reste, chaque client le dérive.
import {
  DynamoDBClient, PutItemCommand, UpdateItemCommand, DeleteItemCommand,
  GetItemCommand, ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient, PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = new DynamoDBClient({});
const CONN = process.env.CONNECTIONS_TABLE;
const NAMES = process.env.NAMES_TABLE;

export const handler = async (event) => {
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  // L'endpoint de management se construit depuis l'event (pas d'env → pas de dépendance circulaire).
  const api = new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
  try {
    switch (routeKey) {
      case "$connect":    return await onConnect(connectionId);
      case "join":        return await onJoin(api, connectionId, event.body);
      case "$disconnect": return await onDisconnect(api, connectionId);
      default:            return { statusCode: 200 };
    }
  } catch (e) {
    console.error(routeKey, e);
    return { statusCode: 500 };
  }
};

// $connect : on enregistre le socket (pas encore de pseudo).
async function onConnect(id) {
  await ddb.send(new PutItemCommand({
    TableName: CONN,
    Item: { connectionId: { S: id }, joinedAt: { N: String(Date.now()) } },
  }));
  return { statusCode: 200 };
}

// join : réservation ATOMIQUE du pseudo → on l'attache → on diffuse le roster.
async function onJoin(api, id, body) {
  let name;
  try { name = JSON.parse(body)?.name?.trim(); } catch { name = null; }
  if (!name) { await send(api, id, { type: "error", message: "name-required" }); return { statusCode: 200 }; }

  // Gère la course : deux personnes tapent le même pseudo à la même milliseconde.
  try {
    await ddb.send(new PutItemCommand({
      TableName: NAMES,
      Item: { name: { S: name }, connectionId: { S: id } },
      ConditionExpression: "attribute_not_exists(#n)",
      ExpressionAttributeNames: { "#n": "name" },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") {
      await send(api, id, { type: "name_taken", name });   // le client redemande un pseudo
      return { statusCode: 200 };
    }
    throw e;
  }

  await ddb.send(new UpdateItemCommand({
    TableName: CONN,
    Key: { connectionId: { S: id } },
    UpdateExpression: "SET #n = :n",
    ExpressionAttributeNames: { "#n": "name" },
    ExpressionAttributeValues: { ":n": { S: name } },
  }));

  await broadcastRoster(api);
  return { statusCode: 200 };
}

// $disconnect : on libère le pseudo (item-lock) + la connexion, on rediffuse.
async function onDisconnect(api, id) {
  const { Item } = await ddb.send(new GetItemCommand({ TableName: CONN, Key: { connectionId: { S: id } } }));
  const name = Item?.name?.S;
  if (name) await ddb.send(new DeleteItemCommand({ TableName: NAMES, Key: { name: { S: name } } }));
  await ddb.send(new DeleteItemCommand({ TableName: CONN, Key: { connectionId: { S: id } } }));
  await broadcastRoster(api);
  return { statusCode: 200 };
}

// --- helpers ---

// Roster = les connexions QUI ont un pseudo (= qui ont "join"). Petite échelle → Scan (on optimisera si besoin).
async function broadcastRoster(api) {
  const { Items = [] } = await ddb.send(new ScanCommand({ TableName: CONN }));
  const players = Items.filter((i) => i.name?.S).map((i) => i.name.S);
  const msg = { type: "roster", players, count: players.length };
  await Promise.all(Items.map((i) => send(api, i.connectionId.S, msg)));
}

async function send(api, id, obj) {
  try {
    await api.send(new PostToConnectionCommand({ ConnectionId: id, Data: JSON.stringify(obj) }));
  } catch (e) {
    // 410 Gone = connexion morte : on nettoie.
    if (e.name === "GoneException" || e.$metadata?.httpStatusCode === 410) {
      await ddb.send(new DeleteItemCommand({ TableName: CONN, Key: { connectionId: { S: id } } })).catch(() => {});
    } else {
      console.error("send", id, e.name);
    }
  }
}
