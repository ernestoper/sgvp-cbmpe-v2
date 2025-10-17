// Netlify Function - COSCIP-PE por CNAE
import fs from 'node:fs';
import path from 'node:path';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function normalizeCode(input = '') {
  return String(input).replace(/\D/g, '');
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const query = event.queryStringParameters || {};
    const code = normalizeCode(query.cnae || '');
    if (!code) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parâmetro cnae é obrigatório' }) };
    }

    // Caminho para o JSON de mapeamento estático
    const mappingPath = path.resolve(__dirname, '../../public/api/coscip-mapeamento.json');
    let list = [];
    try {
      const raw = fs.readFileSync(mappingPath, 'utf-8');
      const json = JSON.parse(raw);
      list = Array.isArray(json) ? json : [];
    } catch (e) {
      console.warn('Falha ao carregar coscip-mapeamento.json:', e);
      list = [];
    }

    const normalize = (s) => String(s || '').replace(/\D/g, '');
    const exact = list.find((it) => normalize(it.cnae) === code);
    const pref = exact || list.find((it) => normalize(it.cnae).startsWith(code));
    if (!pref) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          cnae: code,
          descricao_cnae: undefined,
          coscip_categoria: undefined,
          vistoria: undefined,
          observacao: 'Não encontrado no mapeamento estático (atualize a base oficial)',
          taxa: undefined,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(pref),
    };
  } catch (error) {
    console.error('Erro interno /api/coscip-pe:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno do servidor', message: error.message }) };
  }
};