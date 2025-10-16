/**
 * Script para popular o banco com processos de teste
 * Execute: node v2/scripts/seed-processes.js
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
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

// Dados de exemplo
const empresas = [
  { nome: "Restaurante Sabor Nordestino Ltda", cnpj: "12345678000190", endereco: "Rua da Aurora, 123, Boa Vista, Recife-PE, CEP: 50050-000" },
  { nome: "Hotel Praia Azul S.A.", cnpj: "23456789000191", endereco: "Av. Boa Viagem, 456, Boa Viagem, Recife-PE, CEP: 51020-000" },
  { nome: "Shopping Center Recife", cnpj: "34567890000192", endereco: "Rua do Comércio, 789, Santo Amaro, Recife-PE, CEP: 50100-000" },
  { nome: "Clínica Médica Saúde Total", cnpj: "45678901000193", endereco: "Av. Conde da Boa Vista, 321, Boa Vista, Recife-PE, CEP: 50060-000" },
  { nome: "Supermercado Bom Preço", cnpj: "56789012000194", endereco: "Rua Imperial, 654, São José, Recife-PE, CEP: 50010-000" },
  { nome: "Academia Corpo em Forma", cnpj: "67890123000195", endereco: "Av. Agamenon Magalhães, 987, Espinheiro, Recife-PE, CEP: 52020-000" },
  { nome: "Escola Infantil Pequenos Gênios", cnpj: "78901234000196", endereco: "Rua das Flores, 147, Casa Forte, Recife-PE, CEP: 52061-000" },
  { nome: "Indústria Metalúrgica Nordeste", cnpj: "89012345000197", endereco: "Av. Cruz Cabugá, 258, Santo Amaro, Recife-PE, CEP: 50040-000" },
  { nome: "Bar e Restaurante Frutos do Mar", cnpj: "90123456000198", endereco: "Av. Herculano Bandeira, 369, Pina, Recife-PE, CEP: 51110-000" },
  { nome: "Loja de Departamentos Tudo Aqui", cnpj: "01234567000199", endereco: "Rua do Príncipe, 741, Boa Vista, Recife-PE, CEP: 50050-000" },
];

const contatos = [
  { nome: "João Silva", telefone: "81995609503", email: "joao.silva@email.com" },
  { nome: "Maria Santos", telefone: "81995609503", email: "maria.santos@email.com" },
  { nome: "Pedro Oliveira", telefone: "81995609503", email: "pedro.oliveira@email.com" },
  { nome: "Ana Costa", telefone: "81995609503", email: "ana.costa@email.com" },
  { nome: "Carlos Souza", telefone: "81995609503", email: "carlos.souza@email.com" },
  { nome: "Juliana Lima", telefone: "81995609503", email: "juliana.lima@email.com" },
  { nome: "Roberto Alves", telefone: "81995609503", email: "roberto.alves@email.com" },
  { nome: "Fernanda Rocha", telefone: "81995609503", email: "fernanda.rocha@email.com" },
  { nome: "Lucas Martins", telefone: "81995609503", email: "lucas.martins@email.com" },
  { nome: "Patricia Ferreira", telefone: "81995609503", email: "patricia.ferreira@email.com" },
];

const statuses = [
  "cadastro",
  "triagem",
  "vistoria",
  "comissao",
  "aprovacao",
  "concluido",
];

const generateProcessNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `${year}${random}`;
};

const getRandomDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

async function getOrCreateUser() {
  // Busca ou cria um usuário de teste
  const userId = "test-user-" + randomUUID();

  console.log("Usando user_id:", userId);
  return userId;
}

async function createProcess(userId, empresa, contato, status, daysAgo) {
  const processId = randomUUID();
  const processNumber = generateProcessNumber();
  const createdAt = getRandomDate(daysAgo);

  const process = {
    id: processId,
    user_id: userId,
    process_number: processNumber,
    company_name: empresa.nome,
    cnpj: empresa.cnpj,
    address: empresa.endereco,
    contact_name: contato.nome,
    contact_phone: contato.telefone,
    contact_email: contato.email,
    current_status: status,
    created_at: createdAt,
    updated_at: createdAt,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: "processes",
        Item: process,
      })
    );

    // Criar histórico inicial
    await docClient.send(
      new PutCommand({
        TableName: "process_history",
        Item: {
          id: randomUUID(),
          process_id: processId,
          status: "cadastro",
          step_status: "completed",
          observations: `Processo criado - Contato: ${contato.nome} | ${contato.telefone} | ${contato.email}`,
          created_at: createdAt,
        },
      })
    );

    // Se o status for diferente de cadastro, adicionar mais históricos
    const statusIndex = statuses.indexOf(status);
    if (statusIndex > 0) {
      for (let i = 1; i <= statusIndex; i++) {
        const historyDate = new Date(createdAt);
        historyDate.setDate(historyDate.getDate() + i);

        await docClient.send(
          new PutCommand({
            TableName: "process_history",
            Item: {
              id: randomUUID(),
              process_id: processId,
              status: statuses[i],
              step_status: "completed",
              observations: `Etapa ${statuses[i]} concluída`,
              created_at: historyDate.toISOString(),
            },
          })
        );
      }
    }

    console.log(`✓ Processo ${processNumber} criado - ${empresa.nome} - Status: ${status}`);
    return process;
  } catch (error) {
    console.error(`✗ Erro ao criar processo ${processNumber}:`, error.message);
    throw error;
  }
}

async function seedProcesses() {
  console.log("🌱 Iniciando seed de processos...\n");

  try {
    const userId = await getOrCreateUser();

    // Criar 10 processos com diferentes status e datas
    for (let i = 0; i < empresas.length; i++) {
      const empresa = empresas[i];
      const contato = contatos[i];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const daysAgo = Math.floor(Math.random() * 60) + 1; // 1 a 60 dias atrás

      await createProcess(userId, empresa, contato, status, daysAgo);

      // Pequeno delay para evitar throttling
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log("\n✅ Seed concluído com sucesso!");
    console.log(`📊 ${empresas.length} processos criados`);
    console.log(`👤 User ID usado: ${userId}`);
    console.log("\n💡 Dica: Use este user_id para fazer login ou consultar os processos");

  } catch (error) {
    console.error("\n❌ Erro durante o seed:", error);
    process.exit(1);
  }
}

// Executar
seedProcesses();
