var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/api.js
var api_exports = {};
__export(api_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
console.log("\u{1F527} Configurando DynamoDB API Universal...");
var client = new import_client_dynamodb.DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  }
});
var docClient = import_lib_dynamodb.DynamoDBDocumentClient.from(client);
var headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json"
};
var handler = async (event) => {
  console.log("\u{1F525} API Function called:", event.httpMethod, event.path);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  try {
    let tableName = "processes";
    let path = event.path;
    if (path.includes("/analyses")) {
      tableName = "analyses";
      path = path.replace("/.netlify/functions/api/analyses", "").replace("/api/analyses", "");
    } else if (path.includes("/processes")) {
      tableName = "processes";
      path = path.replace("/.netlify/functions/api/processes", "").replace("/api/processes", "");
    } else if (path.includes("/history")) {
      tableName = "process_history";
      path = path.replace("/.netlify/functions/api/history", "").replace("/api/history", "");
    } else if (path.includes("/documents")) {
      tableName = "process_documents";
      path = path.replace("/.netlify/functions/api/documents", "").replace("/api/documents", "");
    } else if (path.includes("/profiles")) {
      tableName = "profiles";
      path = path.replace("/.netlify/functions/api/profiles", "").replace("/api/profiles", "");
    } else if (path.includes("/roles")) {
      tableName = "user_roles";
      path = path.replace("/.netlify/functions/api/roles", "").replace("/api/roles", "");
    }
    console.log("\u{1F4CA} Table:", tableName, "Path:", path);
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};
    if (method === "GET") {
      if (queryParams.id) {
        const command2 = new import_lib_dynamodb.GetCommand({
          TableName: tableName,
          Key: { id: queryParams.id }
        });
        const result2 = await docClient.send(command2);
        if (!result2.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Item n\xE3o encontrado" })
          };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result2.Item)
        };
      }
      let scanParams = { TableName: tableName };
      if (queryParams.user_id) {
        scanParams.FilterExpression = "user_id = :user_id";
        scanParams.ExpressionAttributeValues = { ":user_id": queryParams.user_id };
      } else if (queryParams.process_id) {
        scanParams.FilterExpression = "process_id = :process_id";
        scanParams.ExpressionAttributeValues = { ":process_id": queryParams.process_id };
      }
      const command = new import_lib_dynamodb.ScanCommand(scanParams);
      const result = await docClient.send(command);
      console.log("\u2705 Items encontrados:", result.Items?.length || 0);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Items || [])
      };
    }
    if (method === "POST") {
      const data = JSON.parse(event.body);
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!data.created_at) {
        data.created_at = (/* @__PURE__ */ new Date()).toISOString();
      }
      if (!data.updated_at) {
        data.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      }
      const command = new import_lib_dynamodb.PutCommand({
        TableName: tableName,
        Item: data
      });
      await docClient.send(command);
      console.log("\u2705 Item criado:", data.id);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id: data.id })
      };
    }
    if (method === "PUT") {
      const data = JSON.parse(event.body);
      const id = data.id;
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "ID \xE9 obrigat\xF3rio" })
        };
      }
      data.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      Object.keys(data).forEach((key, index) => {
        if (key !== "id") {
          updateExpressions.push(`#attr${index} = :val${index}`);
          expressionAttributeNames[`#attr${index}`] = key;
          expressionAttributeValues[`:val${index}`] = data[key];
        }
      });
      const command = new import_lib_dynamodb.UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      });
      await docClient.send(command);
      console.log("\u2705 Item atualizado:", id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Item atualizado" })
      };
    }
    if (method === "DELETE") {
      const data = JSON.parse(event.body);
      const id = data.id;
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "ID \xE9 obrigat\xF3rio" })
        };
      }
      const command = new import_lib_dynamodb.DeleteCommand({
        TableName: tableName,
        Key: { id }
      });
      await docClient.send(command);
      console.log("\u2705 Item deletado:", id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Item deletado" })
      };
    }
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "M\xE9todo n\xE3o suportado" })
    };
  } catch (error) {
    console.error("\u274C Erro:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Erro interno do servidor",
        message: error.message
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=api.js.map
