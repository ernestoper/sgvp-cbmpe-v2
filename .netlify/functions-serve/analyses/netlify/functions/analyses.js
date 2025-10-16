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

// netlify/functions/analyses.js
var analyses_exports = {};
__export(analyses_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(analyses_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
console.log("\u{1F527} Configurando DynamoDB...");
console.log("Region:", process.env.MY_AWS_REGION || process.env.AWS_REGION || "us-east-1");
console.log("Access Key exists:", !!process.env.MY_AWS_ACCESS_KEY_ID || !!process.env.AWS_ACCESS_KEY_ID);
var client = new import_client_dynamodb.DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  }
});
var docClient = import_lib_dynamodb.DynamoDBDocumentClient.from(client);
var getTableFromPath = (path, queryParams) => {
  if (queryParams?.table) return queryParams.table;
  if (path.includes("/processes")) return "processes";
  if (path.includes("/history")) return "process_history";
  if (path.includes("/documents")) return "process_documents";
  if (path.includes("/profiles")) return "profiles";
  if (path.includes("/roles")) return "user_roles";
  return "analyses";
};
var headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json"
};
var handler = async (event) => {
  console.log("\u{1F680} NEW VERSION - Function called:", event.httpMethod, event.path);
  console.log("\u{1F680} Query params:", JSON.stringify(event.queryStringParameters));
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  try {
    console.log("\u{1F50D} DEBUG: Entering try block");
    const queryParams = event.queryStringParameters || {};
    console.log("\u{1F50D} DEBUG: Query params:", JSON.stringify(queryParams));
    const TABLE_NAME = getTableFromPath(event.path, queryParams);
    console.log("\u{1F4CA} Using table:", TABLE_NAME);
    let path = event.path.replace("/.netlify/functions/analyses", "").replace("/.netlify/functions/processes", "").replace("/.netlify/functions/history", "").replace("/.netlify/functions/documents", "").replace("/.netlify/functions/profiles", "").replace("/.netlify/functions/roles", "").replace("/api/analyses", "").replace("/api/processes", "").replace("/api/history", "").replace("/api/documents", "").replace("/api/profiles", "").replace("/api/roles", "");
    const method = event.httpMethod;
    if (method === "GET" && path === "") {
      if (queryParams.id) {
        if (TABLE_NAME === "profiles") {
          console.log("\u{1F464} === BUSCANDO PERFIL POR ID ===");
          console.log("User ID:", queryParams.id);
        }
        const command2 = new import_lib_dynamodb.GetCommand({
          TableName: TABLE_NAME,
          Key: { id: queryParams.id }
        });
        const result2 = await docClient.send(command2);
        if (!result2.Item) {
          if (TABLE_NAME === "profiles") {
            console.log("\u{1F464} Perfil n\xE3o encontrado para ID:", queryParams.id);
          }
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Item n\xE3o encontrado" })
          };
        }
        if (TABLE_NAME === "profiles") {
          console.log("\u{1F464} Perfil encontrado:", JSON.stringify(result2.Item, null, 2));
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result2.Item)
        };
      }
      let scanParams = { TableName: TABLE_NAME };
      if (queryParams.user_id) {
        scanParams.FilterExpression = "user_id = :user_id";
        scanParams.ExpressionAttributeValues = { ":user_id": queryParams.user_id };
      } else if (queryParams.process_id) {
        scanParams.FilterExpression = "process_id = :process_id";
        scanParams.ExpressionAttributeValues = { ":process_id": queryParams.process_id };
      }
      const command = new import_lib_dynamodb.ScanCommand(scanParams);
      const result = await docClient.send(command);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Items || [])
      };
    }
    if (method === "GET" && path === "/stats") {
      const command = new import_lib_dynamodb.ScanCommand({
        TableName: TABLE_NAME
      });
      const result = await docClient.send(command);
      const analyses = result.Items || [];
      const stats = {
        total: analyses.length,
        aprovados: analyses.filter((a) => a.status === "aprovado").length,
        pendentes: analyses.filter((a) => a.status === "pendente").length,
        reprovados: analyses.filter((a) => a.status === "reprovado").length,
        porRisco: {
          baixo: analyses.filter((a) => a.analise?.riskLevel === "low").length,
          medio: analyses.filter((a) => a.analise?.riskLevel === "medium").length,
          alto: analyses.filter((a) => a.analise?.riskLevel === "high").length
        },
        porTipo: {
          DDLCB: analyses.filter((a) => a.certificado?.tipo === "DDLCB").length,
          AR: analyses.filter((a) => a.certificado?.tipo === "AR").length,
          AVCB: analyses.filter((a) => a.certificado?.tipo === "AVCB").length
        }
      };
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(stats)
      };
    }
    if (method === "GET" && path.startsWith("/")) {
      const id = path.substring(1);
      const command = new import_lib_dynamodb.GetCommand({
        TableName: TABLE_NAME,
        Key: { id }
      });
      const result = await docClient.send(command);
      if (!result.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "An\xE1lise n\xE3o encontrada" })
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item)
      };
    }
    if (method === "POST") {
      console.log("\u{1F4BE} Salvando item na tabela:", TABLE_NAME);
      const data = JSON.parse(event.body);
      if (TABLE_NAME === "profiles") {
        console.log("\u{1F464} === CRIANDO PERFIL DE USU\xC1RIO ===");
        console.log("Dados recebidos:", JSON.stringify(data, null, 2));
      }
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      if (TABLE_NAME === "analyses") {
        data.createdAt = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        if (!data.created_at) {
          data.created_at = (/* @__PURE__ */ new Date()).toISOString();
        }
        if (!data.updated_at && TABLE_NAME === "processes") {
          data.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        }
        if (!data.uploaded_at && TABLE_NAME === "process_documents") {
          data.uploaded_at = (/* @__PURE__ */ new Date()).toISOString();
          data.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      console.log("\u{1F4DD} Dados finais:", { id: data.id, table: TABLE_NAME });
      if (TABLE_NAME === "profiles") {
        console.log("\u{1F464} Dados do perfil a serem salvos:", JSON.stringify(data, null, 2));
      }
      const command = new import_lib_dynamodb.PutCommand({
        TableName: TABLE_NAME,
        Item: data
      });
      console.log("\u{1F680} Enviando para DynamoDB...");
      await docClient.send(command);
      console.log("\u2705 Salvo com sucesso!");
      if (TABLE_NAME === "profiles") {
        console.log("\u{1F464} === PERFIL CRIADO COM SUCESSO ===");
      }
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          id: data.id,
          message: TABLE_NAME === "profiles" ? "Perfil criado com sucesso" : "An\xE1lise criada com sucesso"
        })
      };
    }
    if (method === "PUT") {
      console.log("\u{1F504} Atualizando item...");
      const data = JSON.parse(event.body);
      if (!data.id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "ID \xE9 obrigat\xF3rio para atualiza\xE7\xE3o" })
        };
      }
      console.log("\u{1F4D6} Buscando item existente...");
      const getCommand = new import_lib_dynamodb.GetCommand({
        TableName: TABLE_NAME,
        Key: { id: data.id }
      });
      const existingItem = await docClient.send(getCommand);
      if (!existingItem.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "Item n\xE3o encontrado" })
        };
      }
      const mergedData = {
        ...existingItem.Item,
        ...data
      };
      if (TABLE_NAME === "processes" || TABLE_NAME === "process_documents") {
        mergedData.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      }
      console.log("\u{1F4DD} Atualizando:", { id: mergedData.id, table: TABLE_NAME });
      const command = new import_lib_dynamodb.PutCommand({
        TableName: TABLE_NAME,
        Item: mergedData
      });
      console.log("\u{1F680} Enviando atualiza\xE7\xE3o para DynamoDB...");
      await docClient.send(command);
      console.log("\u2705 Atualizado com sucesso!");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: data.id,
          message: "Item atualizado com sucesso"
        })
      };
    }
    if (method === "DELETE") {
      let itemId;
      if (path.startsWith("/") && path.length > 1) {
        itemId = path.substring(1);
      } else {
        const data = JSON.parse(event.body || "{}");
        itemId = data.id;
      }
      if (!itemId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "ID \xE9 obrigat\xF3rio para exclus\xE3o" })
        };
      }
      console.log("\u{1F5D1}\uFE0F Deletando item:", itemId, "da tabela:", TABLE_NAME);
      const command = new import_lib_dynamodb.DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: itemId }
      });
      await docClient.send(command);
      console.log("\u2705 Item deletado com sucesso!");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: `${TABLE_NAME === "process_documents" ? "Documento" : "Item"} deletado com sucesso` })
      };
    }
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Rota n\xE3o encontrada" })
    };
  } catch (error) {
    console.error("\u274C Erro:", error);
    console.error("Stack:", error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Erro interno do servidor",
        message: error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : void 0
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=analyses.js.map
