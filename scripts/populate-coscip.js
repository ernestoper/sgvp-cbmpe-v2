// Script de população do mapeamento COSCIP a partir de CSV/JSON
// Uso:
//   node scripts/populate-coscip.js --input=./data/coscip.csv --out=public/api/coscip-mapeamento.json
//   node scripts/populate-coscip.js --url=https://.../coscip.csv --merge --out=public/api/coscip-mapeamento.json
//   node scripts/populate-coscip.js --input=./data/coscip.json --dry-run

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.replace(/^--/, '').split('=');
      out[k] = v === undefined ? true : v;
    }
  }
  return out;
}

function normalizeCode(input = '') {
  return String(input).replace(/\D/g, '');
}

function normalizeRisk(input = '') {
  const s = String(input).trim().toLowerCase();
  if (!s) return undefined;
  if (/^i$|risco\s*1|isento|isenta|dispensad[oa]|baixa/.test(s)) return 'Risco I';
  if (/^ii$|risco\s*2|m[eé]dio|media|intermedi[aá]rio/.test(s)) return 'Risco II';
  if (/^iii$|risco\s*3|alto/.test(s)) return 'Risco III';
  if (/^iv$|risco\s*4|muito\s*alto|especial/.test(s)) return 'Risco IV';
  return undefined;
}

function defaultTaxa(categoria) {
  switch (categoria) {
    case 'Risco I': return 0;
    case 'Risco II': return 150;
    case 'Risco III': return 300;
    case 'Risco IV': return 600;
    default: return undefined;
  }
}

function defaultVistoria(categoria) {
  if (categoria === 'Risco I') return 'Dispensada';
  if (!categoria) return undefined;
  return 'Obrigatória';
}

function csvParse(text) {
  // Parser CSV simples com suporte a campos entre aspas
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (!cols.length) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = cols[idx]; });
    rows.push(obj);
  }
  return rows;
}

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { // escape ""
        cur += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`)); return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

function chooseBetter(existing, candidate) {
  if (!existing) return candidate;
  const score = (x) => {
    let s = 0;
    if (x.descricao_cnae) s += 1;
    if (x.coscip_categoria) s += 2;
    if (typeof x.taxa === 'number') s += 2;
    if (x.vistoria) s += 1;
    if (x.observacao) s += 0.5;
    return s;
  };
  return score(candidate) >= score(existing) ? candidate : existing;
}

function mapRowToItem(row) {
  const rawCnae = row.cnae ?? row.CNAE ?? row.cnae_codigo ?? row.codigo_cnae;
  const cnae = normalizeCode(rawCnae || '');
  if (!cnae) return null;
  const descricao_cnae = row.descricao_cnae ?? row.descricao ?? row.cnae_descricao ?? row.nome_cnae;
  const catRaw = row.coscip_categoria ?? row.categoria ?? row.risco ?? row.classe;
  const coscip_categoria = normalizeRisk(catRaw ?? '');
  const taxaRaw = row.taxa ?? row.valor ?? row.taxa_bombeiro;
  const taxaNum = taxaRaw !== undefined && taxaRaw !== '' ? Number(String(taxaRaw).replace(/[^0-9.\-]/g, '')) : undefined;
  const taxa = Number.isFinite(taxaNum) ? taxaNum : defaultTaxa(coscip_categoria);
  const vistoriaRaw = row.vistoria ?? row.vistoria_obrigatoria;
  const vistoria = (vistoriaRaw ? String(vistoriaRaw) : defaultVistoria(coscip_categoria)) || undefined;
  const observacao = row.observacao ?? row.obs ?? undefined;

  return { cnae, descricao_cnae, coscip_categoria, vistoria, observacao, taxa };
}

function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return [data];
  return [];
}

async function readSource({ input, url }) {
  if (url) {
    const text = await fetchUrl(url);
    if (/\.json(\?|$)/i.test(url) || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return JSON.parse(text);
    }
    return csvParse(text);
  }
  if (input) {
    const abs = path.resolve(process.cwd(), input);
    const content = fs.readFileSync(abs, 'utf-8');
    if (/\.json$/i.test(abs) || content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return JSON.parse(content);
    }
    return csvParse(content);
  }
  throw new Error('É necessário informar --input=arquivo.csv|json ou --url=https://...');
}

function mergeExisting(outPath, itemsByKey) {
  try {
    const raw = fs.readFileSync(outPath, 'utf-8');
    const existing = JSON.parse(raw);
    for (const it of ensureArray(existing)) {
      const key = normalizeCode(it.cnae);
      if (!key) continue;
      itemsByKey[key] = chooseBetter(itemsByKey[key], it);
    }
  } catch { /* sem merge se inexistente */ }
}

async function main() {
  const args = parseArgs();
  const input = args.input;
  const url = args.url;
  const out = args.out ? path.resolve(process.cwd(), args.out) : path.resolve(__dirname, '../public/api/coscip-mapeamento.json');
  const merge = Boolean(args.merge);
  const dryRun = Boolean(args['dry-run']);

  const source = await readSource({ input, url });
  const rows = ensureArray(source);

  const itemsByKey = {};
  for (const row of rows) {
    const mapped = mapRowToItem(row);
    if (!mapped) continue;
    const key = normalizeCode(mapped.cnae);
    itemsByKey[key] = chooseBetter(itemsByKey[key], mapped);
  }

  if (merge) mergeExisting(out, itemsByKey);

  const result = Object.values(itemsByKey)
    .filter((it) => it && it.cnae)
    .sort((a, b) => Number(a.cnae) - Number(b.cnae));

  const stats = {
    total: rows.length,
    válidos: result.length,
    riscoI: result.filter((x) => x.coscip_categoria === 'Risco I').length,
    riscoII: result.filter((x) => x.coscip_categoria === 'Risco II').length,
    riscoIII: result.filter((x) => x.coscip_categoria === 'Risco III').length,
    riscoIV: result.filter((x) => x.coscip_categoria === 'Risco IV').length,
    semCategoria: result.filter((x) => !x.coscip_categoria).length,
  };

  console.log('Resumo:', stats);
  console.log('Saída:', out);

  if (dryRun) {
    console.log('Dry-run ativo: nenhum arquivo foi escrito.');
    return;
  }

  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Arquivo escrito com ${result.length} registros.`);
}

main().catch((err) => {
  console.error('Falha ao popular COSCIP:', err.message);
  process.exitCode = 1;
});