export interface CoscipMappingItem {
  cnae: string;
  descricao_cnae?: string;
  coscip_categoria?: string;
  vistoria?: string;
  observacao?: string;
  taxa?: number;
}

let _cache: CoscipMappingItem[] | null = null;

function normalizeCode(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

function normalizeRisk(input?: string): string | undefined {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return undefined;
  if (/^(i|risco\s*1)|isent[oa]|dispensad[oa]|baixa/.test(s)) return "Risco I";
  if (/^(ii|risco\s*2)|med(i|\u00E9)\w*|intermedi\w*/.test(s)) return "Risco II";
  if (/^(iii|risco\s*3)|alto/.test(s)) return "Risco III";
  if (/^(iv|risco\s*4)|muito\s*alto|especial/.test(s)) return "Risco IV";
  return undefined;
}

function defaultTaxa(categoria?: string): number | undefined {
  const key = normalizeRisk(categoria);
  if (key === "Risco I") return 0;
  if (key === "Risco II") return 150;
  if (key === "Risco III") return 300;
  if (key === "Risco IV") return 600;
  return undefined;
}

function defaultVistoria(categoria?: string): string | undefined {
  const key = normalizeRisk(categoria);
  if (key === "Risco I") return "Dispensada";
  if (!key) return undefined;
  return "Obrigatória";
}

function normalizeText(s?: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function inferRiskFromDescription(desc?: string): string | undefined {
  const t = normalizeText(desc);
  if (!t) return undefined;
  // Heurística por palavras-chave (ordem: riscos mais altos primeiro)
  if (/explosiv|inflamavel|combustivel|petroleo|refin|quimic/.test(t)) return "Risco IV";
  // Indústria/produção têxtil e de vestuário
  if (/industr|fabric|fabricacao|fabrico|manufatur|malhari|tecelag|textil|confecc|vestuari/.test(t)) return "Risco III";
  // Armazenagem/atacado geralmente acima do varejo
  if (/armazenag|distribuic|atacadist/.test(t)) return "Risco III";
  // Reunião de público / eventos no local
  if (/(feira|congresso|exposic|evento|festas?)/.test(t) && /(organiz|realiz|promoc|gest|prod)/.test(t)) return "Risco III";
  // Organização de eventos sem público no imóvel (escritório)
  if (/(servic|organiz).*(feira|congresso|exposic|evento|festa)/.test(t)) return "Risco II";
  // Construção civil, obras e acabamentos
  if (/(construc|obra|acabament|pintur|reforma|alvenar|gesso|drywall|telhad|revest|piso|serralher|marceneir|hidraulic|eletric)/.test(t)) return "Risco II";
  // Serviços de engenharia (consultoria/projeto em escritório)
  if (/engenhar|projetist|projet\b|consultori\s*t\w*\s*tecnic/.test(t)) return "Risco I";
  // Serviços de costura/terceirização (facção)
  if (/faccao|faccoes|servico\s*de\s*costur|terceirizac/.test(t)) return "Risco II";
  // Comércio varejista e alimentação
  if (/comercio varejista|varejist|loja|supermercad|mercad|minimercad|restaurante|bar|lanchonete/.test(t)) return "Risco II";
  // Serviços profissionais/escritório
  if (/servico profissional|escritorio|consultor|informatica|treinament|contabil/.test(t)) return "Risco I";
  return undefined;
}

function applyDefaults(item: CoscipMappingItem): CoscipMappingItem {
  const normalizedCat = normalizeRisk(item.coscip_categoria);
  const inferred = normalizedCat ? undefined : inferRiskFromDescription(item.descricao_cnae);
  const categoria = normalizedCat || inferred || undefined;
  const vistoria = item.vistoria || (categoria ? defaultVistoria(categoria) : undefined);
  const taxa = typeof item.taxa === "number" ? item.taxa : (categoria ? defaultTaxa(categoria) : undefined);
  const observacao = item.observacao || (!normalizedCat && inferred ? "Classificação por heurística com base na descrição do CNAE" : (!normalizedCat ? "Classificação não definida — ajuste manual se necessário" : undefined));
  return {
    ...item,
    coscip_categoria: categoria,
    vistoria,
    taxa,
    observacao,
  };
}

export async function loadCoscipMapping(): Promise<CoscipMappingItem[]> {
  if (_cache) return _cache;
  try {
    const resp = await fetch("/api/coscip-mapeamento.json", { cache: "no-cache" });
    if (!resp.ok) throw new Error("Falha ao carregar mapeamento COSCIP");
    const json = await resp.json();
    _cache = Array.isArray(json) ? json : [];
  } catch (e) {
    console.warn("COSCIP mapping load error:", e);
    _cache = [];
  }
  return _cache;
}

export async function getCOSCIPbyCNAE(cnaeInput: string, descriptionHint?: string): Promise<CoscipMappingItem | null> {
  const code = normalizeCode(cnaeInput);
  if (!code) return null;

  // 1) Tenta via endpoint dinâmico (/api/coscip-pe)
  try {
    const resp = await fetch(`/api/coscip-pe?cnae=${code}`, { cache: "no-cache" });
    if (resp.ok) {
      const data = await resp.json();
      const hasClassification = !!(data?.coscip_categoria || data?.descricao_cnae || typeof data?.taxa === "number");
      if (hasClassification) {
        const item: CoscipMappingItem = {
          cnae: data.cnae || code,
          descricao_cnae: data.descricao_cnae,
          coscip_categoria: data.coscip_categoria,
          vistoria: data.vistoria,
          observacao: data.observacao,
          taxa: typeof data.taxa === "number" ? data.taxa : undefined,
        };
        return applyDefaults(item);
      }
      // Se não houver classificação, continuar para os fallbacks
    }
  } catch (e) {
    console.warn("/api/coscip-pe indisponível, usando mapeamento local.");
  }

  // 2) Fallback: mapeamento estático local
  const list = await loadCoscipMapping();
  const exact = list.find((it) => normalizeCode(it.cnae) === code);
  if (exact) return applyDefaults({ ...exact, cnae: normalizeCode(exact.cnae) });
  const pref = list.find((it) => normalizeCode(it.cnae).startsWith(code));
  if (pref) return applyDefaults({ ...pref, cnae: normalizeCode(pref.cnae) });

  // 3) Fallback final: buscar descrição na BrasilAPI e inferir risco por heurística
  try {
    const resp2 = await fetch(`https://brasilapi.com.br/api/cnae/v1/${code}`, { cache: "no-cache" });
    if (resp2.ok) {
      const j2 = await resp2.json();
      const desc = j2?.descricao || j2?.description || undefined;
      const inferred = inferRiskFromDescription(desc);
      if (desc || inferred) {
        return applyDefaults({ cnae: code, descricao_cnae: desc, coscip_categoria: inferred });
      }
    }
  } catch (e) {
    console.warn("BrasilAPI CNAE indisponível");
  }

  // 4) Fallback por dica de descrição do input
  const inferredFromHint = inferRiskFromDescription(descriptionHint);
  if (descriptionHint || inferredFromHint) {
    return applyDefaults({ cnae: code, descricao_cnae: descriptionHint, coscip_categoria: inferredFromHint });
  }

  return null;
}