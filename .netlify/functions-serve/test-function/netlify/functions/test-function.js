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

// netlify/functions/test-function.js
var test_function_exports = {};
__export(test_function_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(test_function_exports);
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
var TABLE_NAME = "processes";
var headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json"
};
var handler = async (event) => {
  console.log("\u{1F525} PROCESSES Function called:", event.httpMethod, event.path);
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  try {
    let path = event.path.replace("/.netlify/functions/processes", "").replace("/api/processes", "");
    const method = event.httpMethod;
    console.log("\u{1F4CD} Original path:", event.path);
    console.log("\u{1F4CD} Cleaned path:", path, "Method:", method);
    if (method === "GET" && path === "") {
      const command = new import_lib_dynamodb.ScanCommand({
        TableName: TABLE_NAME
      });
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
      console.log("\u{1F4BE} Salvando an\xE1lise...");
      const data = JSON.parse(event.body);
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      data.createdAt = (/* @__PURE__ */ new Date()).toISOString();
      console.log("\u{1F4DD} Dados:", { id: data.id, cnpj: data.cnpj });
      const command = new import_lib_dynamodb.PutCommand({
        TableName: TABLE_NAME,
        Item: data
      });
      console.log("\u{1F680} Enviando para DynamoDB...");
      await docClient.send(command);
      console.log("\u2705 Salvo com sucesso!");
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          id: data.id,
          message: "An\xE1lise criada com sucesso"
        })
      };
    }
    if (method === "DELETE" && path.startsWith("/")) {
      const id = path.substring(1);
      const command = new import_lib_dynamodb.DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id }
      });
      await docClient.send(command);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "An\xE1lise deletada com sucesso" })
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
//# sourceMappingURL=test-function.js.map
