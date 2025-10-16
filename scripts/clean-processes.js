/**
 * Script para limpar todos os processos do banco
 * Execute: node v2/scripts/clean-processes.js
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env") });

// Configuração do DynamoDB
const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function cleanTable(tableName) {
  console.log(`🧹 Limpando tabela ${tableName}...`);
  
  try {
    // Buscar todos os itens
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      })
    );

    const items = scanResult.Items || [];
    console.log(`   Encontrados ${items.length} itens`);

    // Deletar cada item
    for (const item of items) {
      await docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { id: item.id },
        })
      );
    }

    console.log(`   ✓ ${items.length} itens deletados\n`);
    return items.length;
  } catch (error) {
    console.error(`   ✗ Erro ao limpar ${tableName}:`, error.message);
    throw error;
  }
}

async function cleanProcesses() {
  console.log("🗑️  Iniciando limpeza do banco...\n");

  try {
    const processesDeleted = await cleanTable("processes");
    const historyDeleted = await cleanTable("process_history");

    console.log("✅ Limpeza concluída!");
    console.log(`📊 Total deletado:`);
    console.log(`   - ${processesDeleted} processos`);
    console.log(`   - ${historyDeleted} históricos`);
    console.log("\n💡 Agora você pode rodar o seed novamente: node v2/scripts/seed-processes.js");

  } catch (error) {
    console.error("\n❌ Erro durante a limpeza:", error);
    process.exit(1);
  }
}

// Executar
cleanProcesses();
