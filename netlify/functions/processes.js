// Netlify Function - API para DynamoDB
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  ScanCommand, 
  DeleteCommand,
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';

// Configurar cliente DynamoDB
console.log('🔧 Configurando DynamoDB...');
console.log('Region:', process.env.MY_AWS_REGION || process.env.AWS_REGION || 'us-east-1');
console.log('Access Key exists:', !!process.env.MY_AWS_ACCESS_KEY_ID || !!process.env.AWS_ACCESS_KEY_ID);

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'processes';

// Headers CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  console.log('🔥 PROCESSES Function called:', event.httpMethod, event.path);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Limpar o path - pode vir como /api/analyses ou /.netlify/functions/analyses
    let path = event.path
      .replace('/.netlify/functions/processes', '')
      .replace('/api/processes', '');
    const method = event.httpMethod;
    
    console.log('📍 Original path:', event.path);
    console.log('📍 Cleaned path:', path, 'Method:', method);

    // GET /api/analyses - Listar todas
    if (method === 'GET' && path === '') {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
      });
      
      const result = await docClient.send(command);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Items || []),
      };
    }

    // GET /api/analyses/stats - Estatísticas
    if (method === 'GET' && path === '/stats') {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
      });
      
      const result = await docClient.send(command);
      const analyses = result.Items || [];
      
      const stats = {
        total: analyses.length,
        aprovados: analyses.filter(a => a.status === 'aprovado').length,
        pendentes: analyses.filter(a => a.status === 'pendente').length,
        reprovados: analyses.filter(a => a.status === 'reprovado').length,
        porRisco: {
          baixo: analyses.filter(a => a.analise?.riskLevel === 'low').length,
          medio: analyses.filter(a => a.analise?.riskLevel === 'medium').length,
          alto: analyses.filter(a => a.analise?.riskLevel === 'high').length,
        },
        porTipo: {
          DDLCB: analyses.filter(a => a.certificado?.tipo === 'DDLCB').length,
          AR: analyses.filter(a => a.certificado?.tipo === 'AR').length,
          AVCB: analyses.filter(a => a.certificado?.tipo === 'AVCB').length,
        },
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(stats),
      };
    }

    // GET /api/analyses/:id - Buscar por ID
    if (method === 'GET' && path.startsWith('/')) {
      const id = path.substring(1);
      
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      });
      
      const result = await docClient.send(command);
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Análise não encontrada' }),
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Item),
      };
    }

    // POST /api/analyses - Criar nova análise
    if (method === 'POST') {
      console.log('💾 Salvando análise...');
      const data = JSON.parse(event.body);
      
      // Gerar ID se não existir
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Adicionar timestamp
      data.createdAt = new Date().toISOString();
      
      console.log('📝 Dados:', { id: data.id, cnpj: data.cnpj });
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: data,
      });
      
      console.log('🚀 Enviando para DynamoDB...');
      await docClient.send(command);
      console.log('✅ Salvo com sucesso!');
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          id: data.id, 
          message: 'Análise criada com sucesso' 
        }),
      };
    }

    // DELETE /api/analyses/:id - Deletar análise
    if (method === 'DELETE' && path.startsWith('/')) {
      const id = path.substring(1);
      
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
      });
      
      await docClient.send(command);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Análise deletada com sucesso' }),
      };
    }

    // Rota não encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Rota não encontrada' }),
    };

  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }),
    };
  }
};
