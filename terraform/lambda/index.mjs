import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;

export const handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const route = event.routeKey || `${event.httpMethod} ${event.resource}`;

    switch (route) {
      case "OPTIONS /tareas":
        body = "OK";
        break;

      case "GET /tareas":
        const data = await dynamo.send(new ScanCommand({ TableName: tableName }));
        body = data.Items;
        break;

      case "POST /tareas":
      case "PUT /tareas":
        const requestJSON = JSON.parse(event.body);
        const item = {
          id: String(requestJSON.id || Date.now()),
          info: String(requestJSON.info || ""),
          // Forzamos que guarde el booleano exacto
          completada: requestJSON.completada === true 
        };

        await dynamo.send(new PutCommand({ TableName: tableName, Item: item }));
        body = item;
        break;

      case "DELETE /tareas":
        const { id } = JSON.parse(event.body);
        await dynamo.send(new DeleteCommand({
          TableName: tableName,
          Key: { id: String(id) }
        }));
        body = `Tarea ${id} eliminada`;
        break;

      default:
        throw new Error(`Ruta no soportada: ${route}`);
    }
  } catch (err) {
    statusCode = 400;
    body = { error: err.message };
  }

  return { statusCode, body: JSON.stringify(body), headers };
};