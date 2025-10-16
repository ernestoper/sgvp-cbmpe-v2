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

// Função para detectar a tabela baseado no path ou query param
const getTableFromPath = (path, queryParams) => {
  // Priorizar query param 'table'
  if (queryParams?.table) return queryParams.table;
  
  if (path.includes('/processes')) return 'processes';
  if (path.includes('/history')) return 'process_history';
  if (path.includes('/documents')) return 'process_documents';
  if (path.includes('/profiles')) return 'profiles';
  if (path.includes('/roles')) return 'user_roles';
  return 'analyses'; // default
};

// Headers CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  console.log('🚀 NEW VERSION - Function called:', event.httpMethod, event.path);
  console.log('🚀 Query params:', JSON.stringify(event.queryStringParameters));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🔍 DEBUG: Entering try block');
    const queryParams = event.queryStringParameters || {};
    console.log('🔍 DEBUG: Query params:', JSON.stringify(queryParams));
    
    // Detectar tabela baseado no path original ou query param
    const TABLE_NAME = getTableFromPath(event.path, queryParams);
    console.log('📊 Using table:', TABLE_NAME);
    
    // Limpar o path
    let path = event.path
      .replace('/.netlify/functions/analyses', '')
      .replace('/.netlify/functions/processes', '')
      .replace('/.netlify/functions/history', '')
      .replace('/.netlify/functions/documents', '')
      .replace('/.netlify/functions/profiles', '')
      .replace('/.netlify/functions/roles', '')
      .replace('/api/analyses', '')
      .replace('/api/processes', '')
      .replace('/api/history', '')
      .replace('/api/documents', '')
      .replace('/api/profiles', '')
      .replace('/api/roles', '');
    const method = event.httpMethod;

    // GET - Listar todas ou buscar por ID/filtros
    if (method === 'GET' && path === '') {
      // Se tiver ID na query string, buscar por ID
      if (queryParams.id) {
        if (TABLE_NAME === 'profiles') {
          console.log('👤 === BUSCANDO PERFIL POR ID ===');
          console.log('User ID:', queryParams.id);
        }
        
        const command = new GetCommand({
          TableName: TABLE_NAME,
          Key: { id: queryParams.id },
        });
        
        const result = await docClient.send(command);
        
        if (!result.Item) {
          if (TABLE_NAME === 'profiles') {
            console.log('👤 Perfil não encontrado para ID:', queryParams.id);
          }
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Item não encontrado' }),
          };
        }
        
        if (TABLE_NAME === 'profiles') {
          console.log('👤 Perfil encontrado:', JSON.stringify(result.Item, null, 2));
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.Item),
        };
      }
      
      // Scan com filtros opcionais
      let scanParams = { TableName: TABLE_NAME };
      
      if (queryParams.user_id) {
        scanParams.FilterExpression = 'user_id = :user_id';
        scanParams.ExpressionAttributeValues = { ':user_id': queryParams.user_id };
      } else if (queryParams.process_id) {
        scanParams.FilterExpression = 'process_id = :process_id';
        scanParams.ExpressionAttributeValues = { ':process_id': queryParams.process_id };
      }
      
      const command = new ScanCommand(scanParams);
      
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
      console.log('💾 Salvando item na tabela:', TABLE_NAME);
      const data = JSON.parse(event.body);
      
      // Log específico para criação de perfil
      if (TABLE_NAME === 'profiles') {
        console.log('👤 === CRIANDO PERFIL DE USUÁRIO ===');
        console.log('Dados recebidos:', JSON.stringify(data, null, 2));
      }
      
      // Gerar ID se não existir
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Adicionar timestamps baseado na tabela
      if (TABLE_NAME === 'analyses') {
        data.createdAt = new Date().toISOString();
      } else {
        if (!data.created_at) {
          data.created_at = new Date().toISOString();
        }
        if (!data.updated_at && TABLE_NAME === 'processes') {
          data.updated_at = new Date().toISOString();
        }
        if (!data.uploaded_at && TABLE_NAME === 'process_documents') {
          data.uploaded_at = new Date().toISOString();
          data.updated_at = new Date().toISOString();
        }
      }
      
      console.log('📝 Dados finais:', { id: data.id, table: TABLE_NAME });
      
      if (TABLE_NAME === 'profiles') {
        console.log('👤 Dados do perfil a serem salvos:', JSON.stringify(data, null, 2));
      }
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: data,
      });
      
      console.log('🚀 Enviando para DynamoDB...');
      await docClient.send(command);
      console.log('✅ Salvo com sucesso!');
      
      if (TABLE_NAME === 'profiles') {
        console.log('👤 === PERFIL CRIADO COM SUCESSO ===');
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          id: data.id, 
          message: TABLE_NAME === 'profiles' ? 'Perfil criado com sucesso' : 'Análise criada com sucesso' 
        }),
      };
    }

    // PUT /api/analyses - Atualizar análise
    if (method === 'PUT') {
      console.log('🔄 Atualizando item...');
      const data = JSON.parse(event.body);
      
      if (!data.id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID é obrigatório para atualização' }),
        };
      }
      
      // Buscar item existente primeiro
      console.log('📖 Buscando item existente...');
      const getCommand = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: data.id },
      });
      
      const existingItem = await docClient.send(getCommand);
      
      if (!existingItem.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Item não encontrado' }),
        };
      }
      
      // Mesclar dados existentes com novos dados
      const mergedData = {
        ...existingItem.Item,
        ...data,
      };
      
      // Atualizar timestamp
      if (TABLE_NAME === 'processes' || TABLE_NAME === 'process_documents') {
        mergedData.updated_at = new Date().toISOString();
      }
      
      console.log('📝 Atualizando:', { id: mergedData.id, table: TABLE_NAME });
      
      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: mergedData,
      });
      
      console.log('🚀 Enviando atualização para DynamoDB...');
      await docClient.send(command);
      console.log('✅ Atualizado com sucesso!');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          id: data.id, 
          message: 'Item atualizado com sucesso' 
        }),
      };
    }

    // DELETE - Deletar item
    if (method === 'DELETE') {
      let itemId;
      
      // Tentar pegar ID da URL ou do body
      if (path.startsWith('/') && path.length > 1) {
        itemId = path.substring(1);
      } else {
        // Tentar pegar do body
        const data = JSON.parse(event.body || '{}');
        itemId = data.id;
      }
      
      if (!itemId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID é obrigatório para exclusão' }),
        };
      }
      
      console.log('🗑️ Deletando item:', itemId, 'da tabela:', TABLE_NAME);
      
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: itemId },
      });
      
      await docClient.send(command);
      console.log('✅ Item deletado com sucesso!');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: `${TABLE_NAME === 'process_documents' ? 'Documento' : 'Item'} deletado com sucesso` }),
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
