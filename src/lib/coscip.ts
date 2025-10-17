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

function applyDefaults(item: CoscipMappingItem): CoscipMappingItem {
  const normalizedCat = normalizeRisk(item.coscip_categoria);
  const categoria = normalizedCat || "Risco II"; // padrão funcional quando não mapeado
  const vistoria = item.vistoria || defaultVistoria(categoria) || undefined;
  const taxa = typeof item.taxa === "number" ? item.taxa : defaultTaxa(categoria);
  const observacao = item.observacao || (!normalizedCat ? "Classificação padrão — ajuste manual se necessário" : undefined);
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

export async function getCOSCIPbyCNAE(cnaeInput: string): Promise<CoscipMappingItem | null> {
  const code = normalizeCode(cnaeInput);
  if (!code) return null;

  // 1) Tenta via endpoint dinâmico (/api/coscip-pe)
  try {
    const resp = await fetch(`/api/coscip-pe?cnae=${code}`, { cache: "no-cache" });
    if (resp.ok) {
      const data = await resp.json();
      if (data && (data.cnae || data.coscip_categoria || data.descricao_cnae)) {
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
    }
  } catch (e) {
    console.warn("/api/coscip-pe indisponível, usando mapeamento local.");
  }

  // 2) Fallback: mapeamento estático local
  const list = await loadCoscipMapping();
  const exact = list.find((it) => normalizeCode(it.cnae) === code);
  if (exact) return applyDefaults({ ...exact, cnae: normalizeCode(exact.cnae) });
  const pref = list.find((it) => normalizeCode(it.cnae).startsWith(code));
  return pref ? applyDefaults({ ...pref, cnae: normalizeCode(pref.cnae) }) : null;
}