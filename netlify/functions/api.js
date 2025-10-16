// Netlify Function - API Universal para DynamoDB
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  ScanCommand, 
  DeleteCommand,
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';

// Configurar cliente DynamoDB
console.log('🔧 Configurando DynamoDB API Universal...');

const client = new DynamoDBClient({
  region: process.env.MY_AWS_REGION || process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

// Headers CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  console.log('🔥 API Function called:', event.httpMethod, event.path);
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Detectar qual tabela usar baseado no path
    let tableName = 'processes'; // default
    let path = event.path;
    
    if (path.includes('/analyses')) {
      tableName = 'analyses';
      path = path.replace('/.netlify/functions/api/analyses', '').replace('/api/analyses', '');
    } else if (path.includes('/processes')) {
      tableName = 'processes';
      path = path.replace('/.netlify/functions/api/processes', '').replace('/api/processes', '');
    } else if (path.includes('/history')) {
      tableName = 'process_history';
      path = path.replace('/.netlify/functions/api/history', '').replace('/api/history', '');
    } else if (path.includes('/documents')) {
      tableName = 'process_documents';
      path = path.replace('/.netlify/functions/api/documents', '').replace('/api/documents', '');
    } else if (path.includes('/profiles')) {
      tableName = 'profiles';
      path = path.replace('/.netlify/functions/api/profiles', '').replace('/api/profiles', '');
    } else if (path.includes('/roles')) {
      tableName = 'user_roles';
      path = path.replace('/.netlify/functions/api/roles', '').replace('/api/roles', '');
    }
    
    console.log('📊 Table:', tableName, 'Path:', path);
    
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};

    // GET - Listar todos ou buscar por ID/filtros
    if (method === 'GET') {
      // Se tiver ID na query string, buscar por ID
      if (queryParams.id) {
        const command = new GetCommand({
          TableName: tableName,
          Key: { id: queryParams.id },
        });
        
        const result = await docClient.send(command);
        
        if (!result.Item) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Item não encontrado' }),
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.Item),
        };
      }
      
      // Scan com filtros opcionais
      let scanParams = { TableName: tableName };
      
      if (queryParams.user_id) {
        scanParams.FilterExpression = 'user_id = :user_id';
        scanParams.ExpressionAttributeValues = { ':user_id': queryParams.user_id };
      } else if (queryParams.process_id) {
        scanParams.FilterExpression = 'process_id = :process_id';
        scanParams.ExpressionAttributeValues = { ':process_id': queryParams.process_id };
      }
      
      const command = new ScanCommand(scanParams);
      const result = await docClient.send(command);
      
      console.log('✅ Items encontrados:', result.Items?.length || 0);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Items || []),
      };
    }

    // POST - Criar novo item
    if (method === 'POST') {
      const data = JSON.parse(event.body);
      
      if (!data.id) {
        data.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      if (!data.created_at) {
        data.created_at = new Date().toISOString();
      }
      
      if (!data.updated_at) {
        data.updated_at = new Date().toISOString();
      }
      
      const command = new PutCommand({
        TableName: tableName,
        Item: data,
      });
      
      await docClient.send(command);
      console.log('✅ Item criado:', data.id);
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id: data.id }),
      };
    }

    // PUT - Atualizar item
    if (method === 'PUT') {
      const data = JSON.parse(event.body);
      const id = data.id;
      
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID é obrigatório' }),
        };
      }
      
      data.updated_at = new Date().toISOString();
      
      // Construir UpdateExpression dinamicamente
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};
      
      Object.keys(data).forEach((key, index) => {
        if (key !== 'id') {
          updateExpressions.push(`#attr${index} = :val${index}`);
          expressionAttributeNames[`#attr${index}`] = key;
          expressionAttributeValues[`:val${index}`] = data[key];
        }
      });
      
      const command = new UpdateCommand({
        TableName: tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      });
      
      await docClient.send(command);
      console.log('✅ Item atualizado:', id);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Item atualizado' }),
      };
    }

    // DELETE - Deletar item
    if (method === 'DELETE') {
      const data = JSON.parse(event.body);
      const id = data.id;
      
      if (!id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID é obrigatório' }),
        };
      }
      
      const command = new DeleteCommand({
        TableName: tableName,
        Key: { id },
      });
      
      await docClient.send(command);
      console.log('✅ Item deletado:', id);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Item deletado' }),
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Método não suportado' }),
    };

  } catch (error) {
    console.error('❌ Erro:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro interno do servidor',
        message: error.message 
      }),
    };
  }
};
