/**
 * Script para adicionar o campo 'stage' aos documentos existentes
 * Execute: node v2/scripts/fix-documents-stage.js
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
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

async function fixDocumentsStage() {
  console.log("🔧 Corrigindo campo 'stage' nos documentos...\n");

  try {
    // Buscar todos os documentos
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: "process_documents",
      })
    );

    const documents = scanResult.Items || [];
    console.log(`📄 Encontrados ${documents.length} documentos\n`);

    let updated = 0;
    let skipped = 0;

    for (const doc of documents) {
      if (doc.stage) {
        console.log(`⏭️  Documento ${doc.id} já tem stage: ${doc.stage}`);
        skipped++;
        continue;
      }

      // Buscar o processo para pegar o status atual
      let stage = "cadastro";
      try {
        const processResult = await docClient.send(
          new GetCommand({
            TableName: "processes",
            Key: { id: doc.process_id },
          })
        );
        stage = processResult.Item?.current_status || "cadastro";
      } catch (err) {
        console.warn(`⚠️  Processo ${doc.process_id} não encontrado, usando stage padrão: cadastro`);
      }

      // Atualizar documento com stage
      await docClient.send(
        new PutCommand({
          TableName: "process_documents",
          Item: {
            ...doc,
            stage: stage,
          },
        })
      );

      console.log(`✅ Documento ${doc.document_name} atualizado com stage: ${stage}`);
      updated++;
    }

    console.log(`\n✅ Correção concluída!`);
    console.log(`📊 Resumo:`);
    console.log(`   - ${updated} documentos atualizados`);
    console.log(`   - ${skipped} documentos já tinham stage`);

  } catch (error) {
    console.error("\n❌ Erro durante a correção:", error);
    process.exit(1);
  }
}

// Executar
fixDocumentsStage();
