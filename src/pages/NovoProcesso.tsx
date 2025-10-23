import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, ArrowLeft, Building2, FileText, MapPin, Loader2, User, Phone, Mail, Plus, QrCode, CheckCircle, Upload, Eye, Trash2, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { AppHeaderLogo } from "@/components/AppHeaderLogo";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { getCOSCIPbyCNAE } from "@/lib/coscip";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { DocumentosPorOcupacao } from '@/lib/documents-map';

const NovoProcesso = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);

  // Form state
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [cnaePrincipal, setCnaePrincipal] = useState("");
  const [cnaesSecundarios, setCnaesSecundarios] = useState<string[]>([]);

  // COSCIP mapping state
  const [coscipPrincipal, setCoscipPrincipal] = useState<{
    categoria?: string;
    vistoria?: string;
    observacao?: string;
    descricao_cnae?: string;
    cnae?: string;
    taxa?: number;
  } | null>(null);
  const [coscipPrincipalExpanded, setCoscipPrincipalExpanded] = useState(false);
  const [coscipSecondary, setCoscipSecondary] = useState<
    Array<{
      cnae: string;
      descricao_cnae?: string;
      coscip_categoria?: string;
      vistoria?: string;
      observacao?: string;
      taxa?: number;
    }>
  >([]);

  // Estados do wizard/taxa definidos cedo para evitar TDZ
  const [wizardStep, setWizardStep] = useState(0);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [taxaValor, setTaxaValor] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  // Aceite do Termo de Bombeiro (novo Passo 2)
  const [termoAceito, setTermoAceito] = useState(false);
  const [cidadeEstabelecimento, setCidadeEstabelecimento] = useState<string>("");
  
  // Estados para Finalização (Passo 5)
  const [isento, setIsento] = useState(false);
  const [boletoGerado, setBoletoGerado] = useState(false);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  // Etapa 5 – campos obrigatórios
  const [juntoPagamento, setJuntoPagamento] = useState<"sim" | "nao" | "">("");
  const [termoResponsabilidadeAceito, setTermoResponsabilidadeAceito] = useState(false);

  // Evento temporário
  const [isTemporaryEvent, setIsTemporaryEvent] = useState<'sim' | 'nao'>("nao");
  const [eventName, setEventName] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventTypeOther, setEventTypeOther] = useState("");

  // E-mails adicionais
  const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
  const addEmailField = () => setAdditionalEmails((prev) => (prev.length < 3 ? [...prev, ""] : prev));
  const updateEmailField = (index: number, value: string) => {
    setAdditionalEmails((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Endereço estruturado (Passo 3)
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [municipios, setMunicipios] = useState<Array<{ id: number; nome: string }>>([]);
  const [ibgeMunicipioId, setIbgeMunicipioId] = useState<number | null>(null);
  const [areaConstruida, setAreaConstruida] = useState<number | "">("");
  const [tipoImovel, setTipoImovel] = useState<"residencial" | "comercial" | "industrial" | "misto" | "outro" | "">("");
  const [multiPavimentos, setMultiPavimentos] = useState<"sim" | "nao" | "">("");

  // Campos adicionais do endereço
  const [pontoReferencia, setPontoReferencia] = useState("");
  const [areaTerreno, setAreaTerreno] = useState<number | "">("");
  const [latitude, setLatitude] = useState<number | "">("");
  const [longitude, setLongitude] = useState<number | "">("");
  const [tipoLogradouro, setTipoLogradouro] = useState("");
  const [acessoPublico, setAcessoPublico] = useState<"sim" | "nao" | "">("");
  const [observacoesEndereco, setObservacoesEndereco] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [manualEdit, setManualEdit] = useState(false);

  // Memorial Preliminar (Passo 4)
  const [tipoAtividade, setTipoAtividade] = useState("");
  const [qtdPavimentos, setQtdPavimentos] = useState<number | "">("");
  const [areaTotalConstruida, setAreaTotalConstruida] = useState<number | "">("");
  const [tipoEstrutura, setTipoEstrutura] = useState("");
  const [hasExtintores, setHasExtintores] = useState<"sim" | "nao" | "">("");
  const [hasIluminacaoEmerg, setHasIluminacaoEmerg] = useState<"sim" | "nao" | "">("");
  const [hasSinalizacaoEmerg, setHasSinalizacaoEmerg] = useState<"sim" | "nao" | "">("");
  const [hasHidrantes, setHasHidrantes] = useState<"sim" | "nao" | "">("");
  const [hasSprinklers, setHasSprinklers] = useState<"sim" | "nao" | "">("");
  const [possuiPPCI, setPossuiPPCI] = useState<"sim" | "nao" | "">("");
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  const [memorialResumo, setMemorialResumo] = useState("");

  // Novos campos da Etapa 4 – Memorial Preliminar (ajustada)
  const [riscoOcupacao, setRiscoOcupacao] = useState("");
  const [isCondominio, setIsCondominio] = useState<"sim" | "nao" | "">("");
  const [condominioNome, setCondominioNome] = useState("");
  const [condominioDoc, setCondominioDoc] = useState("");
  const [alturaEdificacao, setAlturaEdificacao] = useState<number | "">("");
  const [capacidadeFisica, setCapacidadeFisica] = useState<number | "">("");
  const [centralGLPInstalada, setCentralGLPInstalada] = useState<"sim" | "nao" | "">("");
  const [numBotijoesGLP, setNumBotijoesGLP] = useState<number | "">("");
  const [pontoGasExiste, setPontoGasExiste] = useState<"sim" | "nao" | "">("");
  const [trabalhaExplosivos, setTrabalhaExplosivos] = useState<"sim" | "nao" | "">("");
  const [existeSistemaFixo, setExisteSistemaFixo] = useState<"sim" | "nao" | "">("");
  const [numeroProjeto, setNumeroProjeto] = useState("");
  const [observacoesGerais, setObservacoesGerais] = useState("");

  // Documentos (Passo 5)
  const allowedDocTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [docPreviews, setDocPreviews] = useState<Record<string, string>>({});
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState(0);
  const [docTypeByName, setDocTypeByName] = useState<Record<string, string>>({});

  // Lista estruturada por item (obrigatórios/opcionais)
  type DocStatus = "pendente" | "enviando" | "enviado" | "erro";
  interface DocItem { id: string; nome: string; obrigatorio: boolean; status: DocStatus; arquivo?: File | null; preview?: string | null; progress?: number; }
  const [docObrigatorios, setDocObrigatorios] = useState<DocItem[]>([]);
  const [docOpcionais, setDocOpcionais] = useState<DocItem[]>([]);

  // Heurística simples para detectar ocupação
  function getOcupacaoTipo(): 'comercial' | 'industrial' | 'default' {
    const s = (coscipPrincipal?.descricao_cnae || cnaePrincipal || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/industr|fabric|manufatur|textil|vestuari|refin|quimic/.test(s)) return 'industrial';
    if (/comerc|varejist|loja|supermercad|mercad|restaurante|bar|lanchonete/.test(s)) return 'comercial';
    return 'default';
  }

  const buildDocsFor = (risk: "I" | "II" | "III" | "IV" | null, isEvent: boolean) => {
    const tipoKey = isEvent ? 'evento_temporario' : getOcupacaoTipo();
    const map = DocumentosPorOcupacao[tipoKey] || DocumentosPorOcupacao.default;
    if (!risk || risk === 'I') {
      return { obrigatorios: [], opcionais: map.II.opcionais.map(d => ({ id: d.id, nome: d.nome, obrigatorio: false, status: 'pendente' })) };
    }
    const set = map[risk as 'II' | 'III' | 'IV'];
    return {
      obrigatorios: set.obrigatorios.map(d => ({ id: d.id, nome: d.nome, obrigatorio: true, status: 'pendente' })),
      opcionais: set.opcionais.map(d => ({ id: d.id, nome: d.nome, obrigatorio: false, status: 'pendente' })),
    };
  };

  useEffect(() => {
    const risk = getGlobalRiskKey();
    const { obrigatorios, opcionais } = buildDocsFor(risk, isTemporaryEvent === 'sim');
    // Revoga URLs antigas para evitar vazamento
    docObrigatorios.forEach(d => { if (d.preview) try { URL.revokeObjectURL(d.preview); } catch {} });
    docOpcionais.forEach(d => { if (d.preview) try { URL.revokeObjectURL(d.preview); } catch {} });
    setDocObrigatorios(obrigatorios);
    setDocOpcionais(opcionais);
  }, [coscipPrincipal, coscipSecondary, isTemporaryEvent]);

  const setDocFile = (id: string, file: File | null) => {
    const validate = (f: File | null) => {
      if (!f) return { ok: true };
      const okType = allowedDocTypes.includes(f.type);
      const okSize = f.size <= 10 * 1024 * 1024;
      if (!okType || !okSize) {
        toast({ title: "Formato ou tamanho inválido", description: "Envie PDF/JPG/PNG até 10 MB.", variant: "destructive" });
        return { ok: false };
      }
      return { ok: true };
    };
    const v = validate(file);
    if (!v.ok) return;

    const apply = (list: DocItem[]) => list.map(d => {
      if (d.id !== id) return d;
      const preview = file ? URL.createObjectURL(file) : null;
      return { ...d, arquivo: file, preview, status: file ? "pendente" : "pendente", progress: 0 };
    });
    setDocObrigatorios(prev => apply(prev));
    setDocOpcionais(prev => apply(prev));
  };

  const removeDocItem = (id: string) => {
    const revoke = (list: DocItem[]) => list.map(d => {
      if (d.id !== id) return d;
      if (d.preview) { try { URL.revokeObjectURL(d.preview); } catch {} }
      return { ...d, arquivo: null, preview: null, status: "pendente", progress: 0 };
    });
    setDocObrigatorios(prev => revoke(prev));
    setDocOpcionais(prev => revoke(prev));
  };

  // Sugestões de CNAE
  const [cnaeSuggestions, setCnaeSuggestions] = useState<string[]>([]);
  const [showCnaeSuggestions, setShowCnaeSuggestions] = useState(false);
  const cnaeFetchAbortRef = useRef<AbortController | null>(null);
  const cnaeFetchTimerRef = useRef<number | null>(null);
  const lastCnaeResultsRef = useRef<string[]>([]);
  const lockCnaePrincipalRef = useRef<boolean>(false);
  const normalizeText = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizeForCode = (s: string) => s.replace(/[.\-\s]/g, "");
  const rankCnaeSuggestions = (results: string[], query: string): string[] => {
    const nq = normalizeText(query);
    const tokens = nq.split(/\s+/).filter(Boolean);
    const codeDigits = query.replace(/\D/g, "");
    return results
      .map((r) => {
        const rn = normalizeText(r);
        const rnCode = normalizeForCode(r);
        const tokenAll = tokens.every((t) => new RegExp(`\\b${t}`).test(rn));
        const baseMatch = tokenAll || rn.includes(nq);
        if (!baseMatch) return null as any;
        let score = 0;
        if (codeDigits && rnCode.includes(codeDigits)) score += 100;
        tokens.forEach((t) => {
          if (new RegExp(`\\b${t}`).test(rn)) score += 10;
          else if (rn.includes(t)) score += 5;
        });
        if (rn.startsWith(nq)) score += 5;
        return { r, score } as any;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score)
      .map((x: any) => x.r);
  };
  const fetchCnaeSuggestions = async (query: string) => {
    if (lockCnaePrincipalRef.current) return;
    const q = query.trim();
    if (!q) {
      setCnaeSuggestions([]);
      setShowCnaeSuggestions(false);
      return;
    }

    // Immediate filter from last results to keep UI responsive
    if (lastCnaeResultsRef.current.length) {
      const imm = rankCnaeSuggestions(lastCnaeResultsRef.current, q);
      if (imm.length) {
        setCnaeSuggestions(imm.slice(0, 8));
        setShowCnaeSuggestions(true);
      }
    }

    // Debounce and abort previous request
    if (cnaeFetchTimerRef.current) {
      clearTimeout(cnaeFetchTimerRef.current);
    }
    cnaeFetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    cnaeFetchAbortRef.current = ctrl;

    cnaeFetchTimerRef.current = window.setTimeout(async () => {
      let results: string[] = [];
      try {
        const resp = await fetch(`https://servicodados.ibge.gov.br/api/v2/cnae/subclasses?search=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json)) {
            results = json
              .map((item: any) => {
                const code = item.id || item.codigo || item.code || "";
                const desc = item.descricao || item.description || item.title || "";
                return code && desc ? `${code} - ${desc}` : desc || code;
              })
              .filter(Boolean);
          }
        }
      } catch {}
      try {
        const codeOnly = q.replace(/\D/g, "");
        if (codeOnly) {
          const resp2 = await fetch(`https://brasilapi.com.br/api/cnae/v1/${codeOnly}`, { signal: ctrl.signal });
          if (resp2.ok) {
            const j2 = await resp2.json();
            const code = j2?.codigo || j2?.code || codeOnly;
            const desc = j2?.descricao || j2?.description || "";
            if (code || desc) {
              results.unshift(`${code}${desc ? " - " + desc : ""}`);
            }
          }
        }
      } catch {}
      if (!results.length) {
        results = [
          "47.89-0 - Comércio varejista de outros produtos",
          "56.10-0 - Restaurantes e outros serviços de alimentação",
          "93.13-1 - Atividades de condicionamento físico",
          "82.11-3 - Serviços combinados de escritório",
        ];
      }
      lastCnaeResultsRef.current = results;
      const filtered = rankCnaeSuggestions(results, q);
      setCnaeSuggestions(filtered.slice(0, 8));
      setShowCnaeSuggestions(filtered.length > 0);
    }, 250);
  };
  const handleSelectCnaeSuggestion = (value: string) => {
    // Lock further searches until user edits again
    lockCnaePrincipalRef.current = true;
    // Cancel any pending fetch and debounce timer
    cnaeFetchAbortRef.current?.abort();
    if (cnaeFetchTimerRef.current) clearTimeout(cnaeFetchTimerRef.current);
    lastCnaeResultsRef.current = [];
    // Apply selection and hide dropdown
    setCnaePrincipal(value);
    setShowCnaeSuggestions(false);
  };

  // Associação COSCIP-PE para CNAE principal
  useEffect(() => {
    const raw = String(cnaePrincipal || "");
    const code = raw.replace(/\D/g, "");
    const parts = raw.split(/\s[-–—]\s/);
    const descHint = parts.length > 1 ? parts.slice(1).join(" - ").trim() : undefined;
    if (!code || code.length < 4) {
      setCoscipPrincipal(null);
      return;
    }
    let active = true;
    (async () => {
      const res = await getCOSCIPbyCNAE(code, descHint);
      if (!active) return;
      if (res) {
        setCoscipPrincipal({
          categoria: res.coscip_categoria,
          vistoria: res.vistoria,
          observacao: res.observacao,
          descricao_cnae: res.descricao_cnae,
          cnae: res.cnae,
          taxa: res.taxa,
        });
      } else {
        setCoscipPrincipal({
          categoria: "Não encontrado",
          vistoria: "Verificação manual necessária",
          observacao: "Este CNAE não possui correspondência direta no COSCIP-PE",
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [cnaePrincipal]);

  // normaliza categoria de risco para I/II/III/IV
  function normalizeRiskCategory(cat?: string): "I" | "II" | "III" | "IV" | null {
    const s = String(cat || "").toLowerCase().trim();
    if (!s) return null;
    // Checa categorias mais específicas primeiro e usa limites de palavra para evitar colisão de substrings
    if (/\brisco\s*iv\b/.test(s) || /(^|\s)iv(\s|$)/.test(s) || s.includes("muito alto") || s.includes("alto risco")) return "IV";
    if (/\brisco\s*iii\b/.test(s) || /(^|\s)iii(\s|$)/.test(s)) return "III";
    if (/\brisco\s*ii\b/.test(s) || /(^|\s)ii(\s|$)/.test(s) || s.includes("médio") || s.includes("medio") || s.includes("intermedi")) return "II";
    if (/\brisco\s*i\b/.test(s) || /(^|\s)i(\s|$)/.test(s) || s.includes("baixo")) return "I";
    return null;
  }

  // Helpers para calcular maior risco e valor de taxa agregado
  const riskOrder: Record<"I" | "II" | "III" | "IV", number> = { I: 1, II: 2, III: 3, IV: 4 };
  const defaultValores: Record<"II" | "III" | "IV", number> = { II: 150, III: 300, IV: 600 };

  const getGlobalRiskKey = (): "I" | "II" | "III" | "IV" | null => {
    const principalKey = normalizeRiskCategory(coscipPrincipal?.categoria);
    const secondaryKeys = coscipSecondary
      .map((s) => normalizeRiskCategory(s.coscip_categoria))
      .filter((k): k is "I" | "II" | "III" | "IV" => !!k);
    const all = [principalKey, ...secondaryKeys].filter(Boolean) as Array<"I" | "II" | "III" | "IV">;
    if (!all.length) return null;
    return all.reduce((max, k) => (riskOrder[k] > riskOrder[max] ? k : max), all[0]);
  };

  const getGlobalTaxValue = (key: "I" | "II" | "III" | "IV"): number => {
    if (key === "I") return 0;
    const values: number[] = [];
    if (typeof coscipPrincipal?.taxa === "number") values.push(coscipPrincipal.taxa);
    coscipSecondary.forEach((s) => {
      if (typeof s.taxa === "number") values.push(s.taxa);
    });
    if (values.length) return Math.max(...values);
  return defaultValores[key as "II" | "III" | "IV"];
};

  // Ajustes de taxa/QR conforme risco, sem avançar automaticamente
  useEffect(() => {
    const key = getGlobalRiskKey();
    if (!key) return;
    // Resetar status de pagamento sempre que a categoria mudar
    setPaymentCompleted(false);
    // Limpar QR e código de referência ao mudar a categoria
    setQrDataUrl(null);
    setReferenceCode(null);
    if (key === "I") {
      setTaxaValor(0);
    }
  }, [coscipPrincipal, coscipSecondary]);

  // Geração de QR/valor e código de referência ao entrar na etapa de Taxa
  useEffect(() => {
    const key = getGlobalRiskKey();
    if (wizardStep !== 1 || !key) return;

    const cnpjDigits = String(cnpj || '').replace(/\D/g, '');
    const suffix = cnpjDigits.slice(-4) || 'XXXX';
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

    if (key === "I") {
      setTaxaValor(0);
      setQrDataUrl(null);
      setReferenceCode(`CBMPE-ISENTO-${stamp}-${suffix}`);
      return;
    }
    const valorBase = getGlobalTaxValue(key);
    setTaxaValor(valorBase);
    const payload = `pix://pagamento?valor=${valorBase}`;
    QRCode.toDataURL(payload)
      .then((url) => {
        setQrDataUrl(url);
        setReferenceCode(`CBMPE-${key}-${stamp}-${suffix}`);
      })
      .catch(() => {
        setQrDataUrl(null);
        setReferenceCode(`CBMPE-${key}-${stamp}-${suffix}`);
      });
  }, [wizardStep, coscipPrincipal, coscipSecondary, cnpj]);

  // Isenção automática quando risco for I
  useEffect(() => {
    const key = getGlobalRiskKey();
    setIsento(key === "I");
  }, [coscipPrincipal, coscipSecondary]);

  // salvar edição manual da categoria
  const salvarEdicaoCOSCIP = () => {
    const key = normalizeRiskCategory(coscipEditSelection);
    if (!key) return;
    const novaVistoria = key === "I" ? "Dispensada" : "Obrigatória";
    const valores: Record<string, number> = { II: 150, III: 300, IV: 600 };
    setCoscipPrincipal((prev) => ({
      ...(prev || {}),
      categoria: `Risco ${key}`,
      vistoria: novaVistoria,
      taxa: key === "I" ? 0 : valores[key],
    }));
    setCoscipEditOpen(false);
  };

  // Mapeamento COSCIP-PE para CNAEs secundários
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapped: Array<{
        cnae: string;
        descricao_cnae?: string;
        coscip_categoria?: string;
        vistoria?: string;
        observacao?: string;
        taxa?: number;
      }> = [];
      for (const s of cnaesSecundarios) {
        const raw = String(s || "");
      const code = raw.replace(/\D/g, "");
      const parts = raw.split(/\s[-–—]\s/);
      const descHint = parts.length > 1 ? parts.slice(1).join(" - ").trim() : undefined;
        if (!code) continue;
        const it = await getCOSCIPbyCNAE(code, descHint);
        mapped.push({
          cnae: code,
          descricao_cnae: it?.descricao_cnae ?? descHint,
          coscip_categoria: it?.coscip_categoria,
          vistoria: it?.vistoria,
          observacao: it?.observacao,
          taxa: it?.taxa,
        });
      }
      if (!cancelled) setCoscipSecondary(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [cnaesSecundarios]);

  // Sugestões de CNAE para secundários
  const [secondaryCnaeSuggestions, setSecondaryCnaeSuggestions] = useState<string[]>([]);
  const [showSecondaryCnaeSuggestions, setShowSecondaryCnaeSuggestions] = useState(false);
  const secondaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [secondaryCaretPos, setSecondaryCaretPos] = useState(0);
  const secondaryFetchAbortRef = useRef<AbortController | null>(null);
  const secondaryFetchTimerRef = useRef<number | null>(null);
  const lastSecondaryResultsRef = useRef<string[]>([]);
  const secondarySearchLockRef = useRef<boolean>(false);
  const fetchSecondaryCnaeSuggestions = async (query: string) => {
    if (secondarySearchLockRef.current) return;
    const q = query.trim();
    if (!q) {
      setSecondaryCnaeSuggestions([]);
      setShowSecondaryCnaeSuggestions(false);
      return;
    }

    // Immediate filter from last results to keep UI responsive
    if (lastSecondaryResultsRef.current.length) {
      const imm = rankCnaeSuggestions(lastSecondaryResultsRef.current, q);
      if (imm.length) {
        setSecondaryCnaeSuggestions(imm.slice(0, 8));
        setShowSecondaryCnaeSuggestions(true);
      }
    }

    // Debounce and abort previous request
    if (secondaryFetchTimerRef.current) {
      clearTimeout(secondaryFetchTimerRef.current);
    }
    secondaryFetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    secondaryFetchAbortRef.current = ctrl;

    secondaryFetchTimerRef.current = window.setTimeout(async () => {
      let results: string[] = [];
      try {
        const resp = await fetch(`https://servicodados.ibge.gov.br/api/v2/cnae/subclasses?search=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json)) {
            results = json
              .map((item: any) => {
                const code = item.id || item.codigo || item.code || "";
                const desc = item.descricao || item.description || item.title || "";
                return code && desc ? `${code} - ${desc}` : desc || code;
              })
              .filter(Boolean);
          }
        }
      } catch {}
      try {
        const codeOnly = q.replace(/\D/g, "");
        if (codeOnly) {
          const resp2 = await fetch(`https://brasilapi.com.br/api/cnae/v1/${codeOnly}`, { signal: ctrl.signal });
          if (resp2.ok) {
            const j2 = await resp2.json();
            const code = j2?.codigo || j2?.code || codeOnly;
            const desc = j2?.descricao || j2?.description || "";
            if (code || desc) {
              results.unshift(`${code}${desc ? " - " + desc : ""}`);
            }
          }
        }
      } catch {}
      if (!results.length) {
        results = [
          "47.89-0 - Comércio varejista de outros produtos",
          "56.10-0 - Restaurantes e outros serviços de alimentação",
          "93.13-1 - Atividades de condicionamento físico",
          "82.11-3 - Serviços combinados de escritório",
        ];
      }
      lastSecondaryResultsRef.current = results;
      const filtered = rankCnaeSuggestions(results, q);
      setSecondaryCnaeSuggestions(filtered.slice(0, 8));
      setShowSecondaryCnaeSuggestions(filtered.length > 0);
    }, 250);
  };
  const handleSelectSecondaryCnaeSuggestion = (value: string) => {
    // Lock search to avoid reopening suggestions immediately after selection
    secondarySearchLockRef.current = true;
    // Cancel any pending fetch and debounce timer
    secondaryFetchAbortRef.current?.abort();
    if (secondaryFetchTimerRef.current) clearTimeout(secondaryFetchTimerRef.current);
    lastSecondaryResultsRef.current = [];

    const raw = secondaryTextareaRef.current?.value ?? cnaesSecundarios.join("\n");
    const caret = secondaryCaretPos;
    const beforeCaret = raw.slice(0, caret);
    const start = beforeCaret.lastIndexOf("\n") + 1;
    const afterCaret = raw.slice(caret);
    const nextNewline = afterCaret.indexOf("\n");
    const end = nextNewline === -1 ? raw.length : caret + nextNewline;
    const newRaw = raw.slice(0, start) + value + raw.slice(end);
    const lines = newRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    setCnaesSecundarios(lines);
    setShowSecondaryCnaeSuggestions(false);
  };

  // Wizard timeline (visual only, não altera o formulário existente)
  const steps = [
    { key: "entrada", label: "Ocupação" },
    { key: "termo", label: "Taxa de Bombeiro" },
    { key: "endereco", label: "Endereço" },
    { key: "memorial", label: "Memorial Descritivo" },
    { key: "finalizacao", label: "Finalização" },
  ];
  // edição manual COSCIP
  const [coscipEditOpen, setCoscipEditOpen] = useState(false);
  const [coscipEditSelection, setCoscipEditSelection] = useState<string>("");

  // Edição por card de CNAE (principal e secundários)
  const [editCnaeTarget, setEditCnaeTarget] = useState<{ type: 'principal' | 'secondary'; index?: number } | null>(null);
  const [editRiskSelection, setEditRiskSelection] = useState<string>("");

  function riskClasses(cat?: string): string {
    const key = normalizeRiskCategory(cat);
    if (key === "I") return "border-green-400 bg-green-50 text-green-700";
    if (key) return "border-red-400 bg-red-50 text-red-700";
    return "border-gray-300 bg-gray-50 text-gray-600";
  }

  const abrirEdicaoCnae = (type: 'principal' | 'secondary', index?: number) => {
    const current = type === 'principal' ? normalizeRiskCategory(coscipPrincipal?.categoria) : normalizeRiskCategory(coscipSecondary[index || 0]?.coscip_categoria);
    setEditCnaeTarget({ type, index });
    setEditRiskSelection(current || "II");
  };

  const salvarEdicaoCnae = () => {
    if (!editCnaeTarget) return;
    const key = normalizeRiskCategory(editRiskSelection);
    if (!key) return;
    const novaVistoria = key === "I" ? "Dispensada" : "Obrigatória";
    const valores: Record<string, number> = { II: 150, III: 300, IV: 600 };
    if (editCnaeTarget.type === "principal") {
      setCoscipPrincipal((prev) => ({
        ...(prev || {}),
        categoria: `Risco ${key}`,
        vistoria: novaVistoria,
        taxa: key === "I" ? 0 : valores[key],
      }));
    } else {
      setCoscipSecondary((prev) =>
        prev.map((item, idx) =>
          idx === editCnaeTarget.index ? { ...item, coscip_categoria: `Risco ${key}`, vistoria: novaVistoria, taxa: key === "I" ? 0 : valores[key] } : item
        )
      );
    }
    const codigo =
      editCnaeTarget.type === 'principal'
        ? (coscipPrincipal?.cnae || cnaePrincipal)
        : (coscipSecondary[editCnaeTarget.index || 0]?.cnae || '');
    registrarHistorico(`CNAE ${codigo} alterado para Risco ${key}`);
    manterEtapaAtual();
    setEditCnaeTarget(null);
  };

  const formRef = useRef<HTMLFormElement>(null);

  const validateCurrentStep = (): boolean => {
    if (!formRef.current) return true;
    return formRef.current.reportValidity();
  };

  const manterEtapaAtual = () => {
    setWizardStep((prev) => prev);
  };

  const registrarHistorico = (msg: string) => {
    console.warn(msg);
    toast({
      title: 'Classificação de Risco Atualizada',
      description: msg,
    });
  };

  // Helpers de CEP/IBGE
  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
  };

  // Máscaras CPF/CNPJ dinâmicas para documento do condomínio
  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1-$2");
    }
    return numbers.slice(0, 11);
  };

  const formatCpfCnpjGeneric = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return formatCPF(numbers);
    }
    return formatCNPJ(numbers);
  };

  const handleCondominioDocChange = (value: string) => {
    setCondominioDoc(formatCpfCnpjGeneric(value));
  };

  const fetchViaCEP = async (cleanCep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      setLogradouro(data.logradouro || "");
      setBairro(data.bairro || "");
      setUf(data.uf || "");
      setCidade(data.localidade || "");
      if (data.uf) await loadMunicipiosByUF(data.uf);
    } catch {}
  };

  const loadMunicipiosByUF = async (ufCode: string) => {
    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufCode}/municipios`);
      const arr = await res.json();
      if (Array.isArray(arr)) {
        setMunicipios(arr);
        const found = arr.find((m: any) => String(m?.nome || "").toLowerCase() === String(cidade).toLowerCase());
        setIbgeMunicipioId(found?.id ?? null);
      }
    } catch {}
  };

  const buscarCep = async () => {
    const clean = cep.replace(/\D/g, "");
    setCepError(null);
    if (clean.length !== 8) {
      setCepError("CEP inválido — informe 8 dígitos.");
      toast({ title: "CEP inválido", description: "Informe 8 dígitos.", variant: "destructive" });
      return;
    }
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data?.erro) {
        setCepError("CEP não encontrado — verifique ou preencha manualmente.");
        toast({ title: "CEP não encontrado", description: "Verifique ou preencha manualmente.", variant: "destructive" });
      } else {
        setLogradouro(data.logradouro || "");
        setBairro(data.bairro || "");
        setUf(data.uf || "");
        setCidade(data.localidade || "");
        if (data.uf) await loadMunicipiosByUF(data.uf);
      }
    } catch {
      setCepError("Erro ao consultar CEP");
      toast({ title: "Erro ao consultar CEP", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoadingCep(false);
    }
  };

  const obterLocalizacao = () => {
    try {
      if (!navigator.geolocation) {
        toast({ title: "Geolocalização indisponível", description: "Seu navegador não suporta.", variant: "destructive" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(Number(pos.coords.latitude.toFixed(6)));
          setLongitude(Number(pos.coords.longitude.toFixed(6)));
          toast({ title: "Localização obtida", description: "Coordenadas preenchidas." });
        },
        (err) => {
          toast({ title: "Falha ao obter localização", description: err?.message || "Permita acesso à localização.", variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch {}
  };

  const validateAddressStep = (): boolean => {
    const errors: string[] = [];
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) errors.push("CEP inválido — informe 8 dígitos.");
    if (!logradouro.trim()) errors.push("Preencha o logradouro.");
    if (!numero.trim()) errors.push("Informe o número.");
    if (!bairro.trim()) errors.push("Informe o bairro.");
    if (!cidade.trim()) errors.push("Informe a cidade.");
    if (errors.length) {
      toast({ title: "Endereço incompleto", description: errors.join(" "), variant: "destructive" });
      return false;
    }
    return true;
  };

  const validateMemorialStep = (): boolean => {
    const errors: string[] = [];

    if (!riscoOcupacao) errors.push("Selecione o risco da ocupação.");

    if (areaTotalConstruida === "" || Number(areaTotalConstruida) <= 0) {
      errors.push("Informe a área construída declarada (m²).");
    }

    if (!isCondominio) {
      errors.push("Informe se é condomínio.");
    } else if (isCondominio === "sim") {
      if (!condominioNome.trim()) errors.push("Informe o nome do condomínio.");
      const docDigits = condominioDoc.replace(/\D/g, "");
      if (!(docDigits.length === 11 || docDigits.length === 14)) {
        errors.push("Informe CPF (11 dígitos) ou CNPJ (14 dígitos) do condomínio.");
      }
    }

    if (alturaEdificacao === "" || Number(alturaEdificacao) <= 0) {
      errors.push("Informe a altura da edificação (m).");
    }

    if (qtdPavimentos === "" || Number(qtdPavimentos) <= 0) {
      errors.push("Informe o número de pavimentos.");
    }

    if (capacidadeFisica === "" || Number(capacidadeFisica) <= 0) {
      errors.push("Informe a capacidade física (pessoas).");
    }

    if (!centralGLPInstalada) {
      errors.push("Informe se há central de gás (GLP) instalada.");
    } else if (centralGLPInstalada === "sim") {
      if (numBotijoesGLP === "" || Number(numBotijoesGLP) <= 0) {
        errors.push("Informe o número de botijões de GLP (Kg).");
      }
      if (!pontoGasExiste) {
        errors.push("Informe se o ponto de gás existe.");
      }
    }

    if (!trabalhaExplosivos) errors.push("Informe se trabalha com explosivos ou produtos perigosos.");
    if (!existeSistemaFixo) errors.push("Informe se existe sistema fixo.");

    if (errors.length) {
      toast({ title: "Memorial incompleto", description: errors.join(" "), variant: "destructive" });
      return false;
    }
    return true;
  };

  // Fixar UF como Pernambuco e carregar municípios ao entrar na Etapa 3
  useEffect(() => {
    if (!uf) {
      setUf('PE');
      loadMunicipiosByUF('PE');
    }
  }, []);

  useEffect(() => {
    const full = [
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      cep ? `CEP: ${cep}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    setAddress(full);
  }, [logradouro, numero, complemento, bairro, cidade, uf, cep]);

  // Auto-save do draft de endereço (debounced)
  useEffect(() => {
    const payload = {
      cep: cep.replace(/\D/g, ""),
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      ponto_referencia: pontoReferencia,
      area_construida_m2: areaConstruida || null,
      area_terreno_m2: areaTerreno || null,
      tipo_logradouro: tipoLogradouro,
      tipo_imovel: tipoImovel,
      multi_pavimentos: multiPavimentos,
      latitude: latitude || null,
      longitude: longitude || null,
      ibge_municipio_id: ibgeMunicipioId,
      observacoes: observacoesEndereco,
    };
    const t = setTimeout(() => {
      try { localStorage.setItem("sgvp:novo-processo:addressDraft", JSON.stringify(payload)); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [cep, logradouro, numero, complemento, bairro, cidade, uf, pontoReferencia, areaConstruida, areaTerreno, tipoLogradouro, tipoImovel, multiPavimentos, latitude, longitude, ibgeMunicipioId, observacoesEndereco]);

  // Dropzone de documentos (Passo 5)
  const onDocsDrop = (acceptedFiles: File[]) => {
    const valid = acceptedFiles.filter((f) => allowedDocTypes.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length !== acceptedFiles.length) {
      toast({
        title: "Alguns arquivos foram ignorados",
        description: "Aceitos: PDF/JPG/PNG até 10MB",
        variant: "destructive",
      });
    }
    const next = [...pendingDocs, ...valid];
    setPendingDocs(next);
    const previews: Record<string, string> = {};
    next.forEach((f) => {
      if (f.type.startsWith("image/") || f.type === "application/pdf") {
        previews[f.name] = URL.createObjectURL(f);
      }
    });
    setDocPreviews((prev) => ({ ...prev, ...previews }));
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: onDocsDrop });

  const clearPendingDoc = (name: string) => {
    setPendingDocs((files) => files.filter((f) => f.name !== name));
    const url = docPreviews[name];
    if (url) URL.revokeObjectURL(url);
    setDocPreviews((prev) => {
      const cpy = { ...prev };
      delete cpy[name];
      return cpy;
    });
    setDocTypeByName((prev) => {
      const cpy = { ...prev };
      delete cpy[name];
      return cpy;
    });
  };

  const handleTimelineClick = (i: number) => {
    // Se estiver avançando, valida os campos obrigatórios do passo atual
    if (i > wizardStep) {
      const valid = validateCurrentStep();
      if (!valid) return;
      // Bloqueio específico do passo 2: cidade selecionada
      if (wizardStep === 1 && !cidadeEstabelecimento) {
        toast({
          title: "Selecione a cidade",
          description: "Escolha a cidade do estabelecimento para continuar.",
          variant: "destructive",
        });
        return;
      }
    }
    setWizardStep(i);
  };

  const simulatePayment = () => {
    setProcessingPayment(true);
    setTimeout(() => {
      setProcessingPayment(false);
      setPaymentCompleted(true);
      toast({
        title: "Pagamento realizado",
        description: "Taxa de Bombeiro paga com sucesso.",
      });
      // Avança automaticamente para a próxima etapa ao confirmar pagamento
      setWizardStep((prev) => Math.min(prev + 1, 4));
    }, 800);
  };

  const formatCNPJ = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    
    // Aplica a máscara do CNPJ
    if (numbers.length <= 14) {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers.slice(0, 14);
  };

  const handleCNPJChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setCnpj(formatted);
  };

  const fetchCNPJData = async () => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    
    if (cleanCNPJ.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ deve conter 14 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setLoadingCNPJ(true);

    try {
      // Using ReceitaWS API - Free CNPJ lookup service
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data = await response.json();

      // Fill form with API data
      setCompanyName(data.razao_social || data.nome_fantasia || "");
      
      // Format address
      const fullAddress = [
        data.descricao_tipo_de_logradouro,
        data.logradouro,
        data.numero,
        data.complemento,
        data.bairro,
        data.municipio,
        data.uf,
        `CEP: ${data.cep}`,
      ]
        .filter(Boolean)
        .join(", ");
      
      setAddress(fullAddress);

      // Extract CNAEs (principal and secondary) from API response
      try {
        let principalLabel = "";
        if ((data as any).cnae_fiscal) {
          const code = String((data as any).cnae_fiscal);
          const desc =
            (data as any).descricao_cnae_fiscal ||
            (data as any).cnae_fiscal_descricao ||
            "";
          principalLabel = desc ? `${code} - ${desc}` : code;
        } else if (Array.isArray((data as any).atividade_principal) && (data as any).atividade_principal.length) {
          const ap = (data as any).atividade_principal[0];
          const code = ap.code || ap.codigo || "";
          const desc = ap.text || ap.descricao || "";
          principalLabel = code ? (desc ? `${code} - ${desc}` : String(code)) : desc;
        }

        const secundarias = Array.isArray((data as any).cnaes_secundarios)
          ? (data as any).cnaes_secundarios.map((item: any) => {
              const code = item.codigo || item.code || "";
              const desc = item.descricao || item.text || "";
              return code ? (desc ? `${code} - ${desc}` : String(code)) : desc;
            })
          : Array.isArray((data as any).atividades_secundarias)
          ? (data as any).atividades_secundarias.map((item: any) => {
              const code = item.codigo || item.code || "";
              const desc = item.descricao || item.text || "";
              return code ? (desc ? `${code} - ${desc}` : String(code)) : desc;
            })
          : [];

        setCnaePrincipal(principalLabel);
        setCnaesSecundarios(secundarias);
      } catch {}

      // Auto-fill contact email and phone if available
      try {
        if ((data as any).email) {
          setContactEmail((data as any).email);
        }
        const rawPhone =
          (data as any).telefone ||
          (data as any).ddd_telefone_1 ||
          (data as any).ddd_telefone_2 ||
          "";
        const digits = String(rawPhone).replace(/\D/g, "");
        if (digits.length >= 10) {
          setContactPhone(formatPhoneBr(digits));
        }
      } catch {}

      toast({
        title: "Dados carregados!",
        description: "Informações da empresa foram preenchidas automaticamente.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao buscar CNPJ",
        description: error.message || "Verifique o CNPJ e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const generateProcessNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `${year}${random}`;
  };

  // Formatação e normalização de telefone BR (DDD + número)
  const formatPhoneBr = (input: string) => {
    const digits = input.replace(/\D/g, "");
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (!digits) return "";
    if (digits.length <= 2) return ddd;
    if (digits.length <= 7) return `(${ddd}) ${rest}`;
    if (digits.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    // 11 dígitos (celular)
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 11)}`;
  };

  const normalizePhoneDigits = (input: string) => input.replace(/\D/g, "");

  const sendWhatsAppNotification = async (phone: string, processNumber: string, companyName: string, contactName: string, boletoLink?: string) => {
    console.log("📱 === ENVIANDO WHATSAPP ===");
    console.log("Telefone:", phone);
    console.log("Processo:", processNumber);
    
    try {
      const evolutionApiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
      const evolutionApiToken = import.meta.env.VITE_EVOLUTION_API_TOKEN;
      const evolutionInstance = import.meta.env.VITE_EVOLUTION_INSTANCE;

      if (!evolutionApiUrl || !evolutionApiToken || !evolutionInstance) {
        console.log("⚠️ Configuração do WhatsApp não encontrada, pulando envio");
        return;
      }

      const boletoLine = boletoLink ? `\n💳 *Link de Pagamento:* ${boletoLink}\n` : "";

      const message = `🔥 *CBM-PE - Processo Criado* 🔥

Olá *${contactName}*!

Seu processo foi criado com sucesso:

📋 *Número do Processo:* ${processNumber}
🏢 *Empresa:* ${companyName}
📅 *Data:* ${new Date().toLocaleDateString('pt-BR')}

✅ *Próximos passos:*
• Envie os documentos obrigatórios
• Acompanhe o status pelo sistema
• Aguarde o agendamento da vistoria
${boletoLine}🌐 *Acesse:* ${window.location.origin}/processo/${processNumber}

*Corpo de Bombeiros Militar de Pernambuco*
_Sistema SGVP - Gestão de Vistorias_`;

      const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiToken,
        },
        body: JSON.stringify({
          number: `55${phone}`, // Adiciona código do Brasil
          text: message,
        }),
      });

      if (response.ok) {
        console.log("✅ WhatsApp enviado com sucesso!");
      } else {
        const error = await response.text();
        console.error("❌ Erro ao enviar WhatsApp:", error);
      }
    } catch (error) {
      console.error("❌ Erro na função de WhatsApp:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Validações dos contatos
      if (!contactName.trim() || !contactPhone.trim() || !contactEmail.trim()) {
        throw new Error("Preencha Nome completo, telefone e e-mail.");
      }
      const phoneDigits = normalizePhoneDigits(contactPhone);
      if (phoneDigits.length !== 11) {
        throw new Error("Telefone inválido. Informe seu WhatsApp com DDD (ex.: 81900000000).");
      }
      const emailOk = /.+@.+\..+/.test(contactEmail.trim());
      if (!emailOk) {
        throw new Error("E-mail inválido.");
      }

      // Validações da Etapa 5
      if (!termoResponsabilidadeAceito) {
        throw new Error("Você deve aceitar o Termo de Responsabilidade.");
      }
      if (!juntoPagamento) {
        throw new Error("Selecione a opção “Junto de Pagamento?”.");
      }
      if (getGlobalRiskKey() !== "I" && !isento && !boletoGerado) {
        throw new Error("Gere o boleto para prosseguir.");
      }

      const processNumber = generateProcessNumber();

      // Inserção com fallback quando banco remoto não tem colunas de contato
      const payload = {
        user_id: user.id,
        process_number: processNumber,
        company_name: companyName,
        cnpj: cnpj.replace(/\D/g, ""),
        address: address,
        contact_name: contactName.trim(),
        contact_phone: phoneDigits,
        contact_email: contactEmail.trim(),
        current_status: "aguardando_pagamento",
      };

      const isMissingContactError = (err: any) => {
        const msg = err?.message || "";
        const details = err?.details || "";
        const hint = err?.hint || "";
        return ["contact_name", "contact_phone", "contact_email"].some(
          (f) => msg.includes(f) || details.includes(f) || hint.includes(f)
        );
      };

      // Create process in DynamoDB
      const riskKey = getGlobalRiskKey();
      const riskLabel = riskKey === "I" ? "BAIXO" : riskKey === "II" ? "MÉDIO" : riskKey === "III" ? "ALTO" : riskKey === "IV" ? "MUITO ALTO" : undefined;
      const processData = {
        user_id: user.id,
        process_number: processNumber,
        company_name: companyName,
        cnpj: cnpj.replace(/\D/g, ""),
        address: address,
        current_status: "aguardando_pagamento" as const,
        contact_name: contactName.trim() || undefined,
        contact_phone: phoneDigits || undefined,
        contact_email: contactEmail.trim() || undefined,
        cnae_principal: cnaePrincipal || undefined,
        cnaes_secundarios: cnaesSecundarios,
        coscip_principal: coscipPrincipal
          ? {
              cnae: coscipPrincipal.cnae || cnaePrincipal.replace(/\D/g, ""),
              categoria: coscipPrincipal.categoria,
              vistoria: coscipPrincipal.vistoria,
              taxa: typeof taxaValor === "number" ? Number(taxaValor) : coscipPrincipal.taxa,
              observacao: coscipPrincipal.observacao,
            }
          : undefined,
        coscip_secundarios: coscipSecondary,
        taxa_bombeiro_valor: typeof taxaValor === "number" ? Number(taxaValor) : undefined,
        taxa_bombeiro_pago: paymentCompleted,
        boleto_url: boletoUrl || undefined,
        risco_final: riskLabel,
        // Etapa 3 – Endereço estruturado
        cep: cep || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        cidadeEstabelecimento: cidadeEstabelecimento || undefined,
        uf: uf || undefined,
        areaConstruida: typeof areaConstruida === "number" ? Number(areaConstruida) : undefined,
        tipoImovel: tipoImovel || undefined,
        multiPavimentos: multiPavimentos || undefined,
        pontoReferencia: pontoReferencia || undefined,
        areaTerreno: typeof areaTerreno === "number" ? Number(areaTerreno) : undefined,
        latitude: typeof latitude === "number" ? Number(latitude) : undefined,
        longitude: typeof longitude === "number" ? Number(longitude) : undefined,
        tipoLogradouro: tipoLogradouro || undefined,
        acessoPublico: acessoPublico || undefined,
        observacoesEndereco: observacoesEndereco || undefined,
        // Etapa 4 – Memorial Preliminar
        tipoAtividade: tipoAtividade || undefined,
        qtdPavimentos: typeof qtdPavimentos === "number" ? Number(qtdPavimentos) : undefined,
        areaTotalConstruida: typeof areaTotalConstruida === "number" ? Number(areaTotalConstruida) : undefined,
        tipoEstrutura: tipoEstrutura || undefined,
        hasExtintores: hasExtintores || undefined,
        hasIluminacaoEmerg: hasIluminacaoEmerg || undefined,
        hasSinalizacaoEmerg: hasSinalizacaoEmerg || undefined,
        hasHidrantes: hasHidrantes || undefined,
        hasSprinklers: hasSprinklers || undefined,
        possuiPPCI: possuiPPCI || undefined,
        memorialResumo: memorialResumo.trim() || undefined,
      };

      const result = await dynamodb.processes.create(processData);
      const processId = result.id;

      // Montar observações iniciais com evento e e-mails adicionais
      const additionalEmailsFiltered = additionalEmails.map(e => e.trim()).filter(Boolean);
      const emailsExtra = additionalEmailsFiltered.length
        ? ` | E-mails adicionais: ${additionalEmailsFiltered.join(", ")}`
        : "";
      const eventSummary = isTemporaryEvent === 'sim'
        ? ` | Evento: ${eventName || '—'}; Início: ${eventStartDate || '—'}; Fim: ${eventEndDate || '—'}; Tipo: ${(eventType === 'Outros' ? (eventTypeOther || 'Outros') : eventType) || '—'}`
        : "";

      // Create initial history entry
      await dynamodb.history.create({
        process_id: processId,
        status: "cadastro",
        step_status: "completed",
        observations: `Processo criado pelo usuário — Contato: ${contactName.trim()} | ${formatPhoneBr(phoneDigits)} | ${contactEmail.trim()}${emailsExtra}${eventSummary}`,
        responsible_id: user.id,
        responsible_name: "Usuário",
      });

      // Registrar boleto na timeline se gerado
      if (boletoUrl) {
        await dynamodb.history.create({
          process_id: processId,
          status: "aguardando_pagamento",
          step_status: "in_progress",
          observations: `Boleto gerado — disponível na Timeline. Código de referência: ${referenceCode || "—"}.`,
          responsible_id: user.id,
          responsible_name: "Usuário",
        });
      }

      // Upload automático de memorial e documentos (pós-criação)
      try {
        const { storage } = await import("@/lib/storage");
        const structured = [...docObrigatorios.filter(d => d.arquivo), ...docOpcionais.filter(d => d.arquivo)];
        let totalToUpload = (memorialFile ? 1 : 0) + pendingDocs.length + structured.length;
        if (totalToUpload > 0) {
          setDocUploading(true);
          setDocUploadProgress(0);
          let uploaded = 0;

          // Memorial técnico
          if (memorialFile) {
            const memorialUrl = await storage.upload(memorialFile, `process-documents/${processId}`);
            const memorialDocType = memorialFile.type === "application/pdf" ? "pdf" : (memorialFile.type.includes("word") ? "docx" : "arquivo");
            await dynamodb.documents.create({
              process_id: processId,
              document_name: "Memorial Técnico",
              document_type: memorialDocType,
              file_url: memorialUrl,
              status: "pending",
              stage: "cadastro",
            });
            uploaded += 1;
            setDocUploadProgress(Math.round((uploaded / totalToUpload) * 100));
          }

          // Documentos estruturados (obrigatórios/opcionais)
          for (const d of structured) {
            // status: enviando
            setDocObrigatorios(prev => prev.map(x => x.id === d.id ? { ...x, status: "enviando" } : x));
            setDocOpcionais(prev => prev.map(x => x.id === d.id ? { ...x, status: "enviando" } : x));
            const f = d.arquivo!;
            const fileUrl = await storage.upload(f, `process-documents/${processId}`);
            const docType =
              f.type.startsWith("image/") ? "imagem" :
              f.type === "application/pdf" ? "pdf" :
              f.type.includes("word") ? "docx" :
              f.type.includes("sheet") ? "xlsx" : "arquivo";
            const label = d.nome;
            await dynamodb.documents.create({
              process_id: processId,
              document_name: label,
              document_type: docType,
              file_url: fileUrl,
              status: "pending",
              stage: "cadastro",
            });
            uploaded += 1;
            setDocUploadProgress(Math.round((uploaded / totalToUpload) * 100));
            // status: enviado
            setDocObrigatorios(prev => prev.map(x => x.id === d.id ? { ...x, status: "enviado", progress: 100 } : x));
            setDocOpcionais(prev => prev.map(x => x.id === d.id ? { ...x, status: "enviado", progress: 100 } : x));
          }

          // Demais anexos livres (dropzone)
          for (const f of pendingDocs) {
            const fileUrl = await storage.upload(f, `process-documents/${processId}`);
            const docType =
              f.type.startsWith("image/") ? "imagem" :
              f.type === "application/pdf" ? "pdf" :
              f.type.includes("word") ? "docx" :
              f.type.includes("sheet") ? "xlsx" : "arquivo";
            const label = docTypeByName[f.name] || f.name;
            await dynamodb.documents.create({
              process_id: processId,
              document_name: label,
              document_type: docType,
              file_url: fileUrl,
              status: "pending",
              stage: "cadastro",
            });
            uploaded += 1;
            setDocUploadProgress(Math.round((uploaded / totalToUpload) * 100));
          }

          toast({ title: "Documentos anexados", description: "Arquivos enviados para análise." });
          // Limpar estado local dos arquivos
          setPendingDocs([]);
          Object.values(docPreviews).forEach((u) => URL.revokeObjectURL(u));
          setDocPreviews({});
        }
      } catch (err: any) {
        console.error("Erro ao anexar documentos:", err);
        toast({ title: "Falha ao anexar documentos", description: err.message || "Tente reenviar pelo detalhe do processo.", variant: "destructive" });
      } finally {
        setDocUploading(false);
        setDocUploadProgress(0);
      }

      // Enviar WhatsApp de confirmação
      await sendWhatsAppNotification(phoneDigits, processNumber, companyName, contactName.trim(), boletoUrl || undefined);

      toast({
        title: "Processo criado!",
        description: `Processo ${processNumber} criado com sucesso. WhatsApp enviado!`,
      });

      navigate(`/processo/${processId}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar processo",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/usuario")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <AppHeaderLogo />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Nova Solicitação de Atestado de Regularidade</h2>
          <p className="text-muted-foreground">A solicitação e dividida em 5 passos que precisam ser preenchidas.</p>
        </div>

        {/* Timeline dos 5 passos — compacta e proporcional ao formulário */}
        <Card className="p-4 md:p-6 mb-6">
          <div className="relative px-2 md:px-4">
            {/* Linha conectora contínua atrás dos círculos */}
            <span className="absolute top-4 left-4 right-4 h-0.5 bg-muted" aria-hidden="true" />
            <ol className="grid grid-cols-5 gap-2">
              {steps.map((s, i) => {
                const isCompleted = i < wizardStep;
                const isCurrent = i === wizardStep;
                const circleClasses = isCurrent
                  ? "bg-primary text-white ring-2 ring-primary/30"
                  : isCompleted
                    ? "bg-primary/80 text-white"
                    : "bg-muted text-muted-foreground";
                const labelClasses = isCurrent
                  ? "text-primary font-medium"
                  : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground";
                return (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <button
                      type="button"
                      className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${circleClasses}`}
                      aria-current={isCurrent ? "step" : undefined}
                      onClick={() => handleTimelineClick(i)}
                      title={s.label}
                    >
                      {i + 1}
                    </button>
                    <span className={`mt-2 text-xs sm:text-sm leading-tight ${labelClasses}`}>
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>

        <Card className="p-8">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {wizardStep === 0 && (
              <>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ da Empresa *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    className="pl-10"
                    value={cnpj}
                    onChange={(e) => handleCNPJChange(e.target.value)}
                    required
                    maxLength={18}
                  />
                </div>
                <Button
                  type="button"
                  onClick={fetchCNPJData}
                  disabled={loadingCNPJ || cnpj.replace(/\D/g, "").length !== 14}
                >
                  {loadingCNPJ ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    "Buscar Dados"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em "Buscar Dados" para preencher automaticamente
              </p>
              {/* CNAE movido para seção Ocupação abaixo */}
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Razão Social / Nome da Empresa *</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyName"
                  placeholder="Nome da empresa"
                  className="pl-10"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Seção Ocupação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">1. Ocupação</h3>

              {/* Evento temporário? */}
              <div className="space-y-2">
                <Label>É um evento temporário?</Label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="evento_temporario"
                      value="sim"
                      checked={isTemporaryEvent === 'sim'}
                      onChange={() => setIsTemporaryEvent('sim')}
                    />
                    <span>Sim</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="evento_temporario"
                      value="nao"
                      checked={isTemporaryEvent === 'nao'}
                      onChange={() => setIsTemporaryEvent('nao')}
                    />
                    <span>Não</span>
                  </label>
                </div>
              </div>

              {isTemporaryEvent === 'sim' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="eventName">Nome do Evento</Label>
                    <Input
                      id="eventName"
                      placeholder="Ex.: Festival da Cidade"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventStartDate">Início do Evento</Label>
                    <Input
                      id="eventStartDate"
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventEndDate">Fim do Evento</Label>
                    <Input
                      id="eventEndDate"
                      type="date"
                      value={eventEndDate}
                      onChange={(e) => setEventEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="eventType">Tipo de Evento</Label>
                    <select
                      id="eventType"
                      className="w-full border rounded-md h-10 px-3 bg-background"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      <option value="Circo">Circo</option>
                      <option value="Camarote">Camarote</option>
                      <option value="Feira">Feira</option>
                      <option value="Festival">Festival</option>
                      <option value="Show">Show</option>
                      <option value="Outros">Outros</option>
                    </select>
                    {eventType === 'Outros' && (
                      <div className="mt-2">
                        <Label htmlFor="eventTypeOther">Informe o tipo</Label>
                        <Input
                          id="eventTypeOther"
                          placeholder="Descreva o tipo de evento"
                          value={eventTypeOther}
                          onChange={(e) => setEventTypeOther(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Atividades Econômica - CNAE */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Atividades Econômicas</h4>
                <Label htmlFor="cnae-principal">CNAE principal</Label>
                <div className="relative">
                  <Input
                    id="cnae-principal"
                    placeholder="Ex.: 47.89-0 - Comércio varejista de..."
                    value={cnaePrincipal}
                    onFocus={() => {
                      if (!lockCnaePrincipalRef.current && cnaePrincipal.trim()) {
                        fetchCnaeSuggestions(cnaePrincipal);
                        setShowCnaeSuggestions(true);
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Unlock search once user edits after selecting
                      lockCnaePrincipalRef.current = false;
                      setCnaePrincipal(val);
                      fetchCnaeSuggestions(val);
                      setShowCnaeSuggestions(!!val.trim());
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowCnaeSuggestions(false), 150);
                    }}
                  />
                  {showCnaeSuggestions && cnaeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-background border rounded-md shadow z-50 max-h-48 overflow-y-auto">
                      {cnaeSuggestions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectCnaeSuggestion(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Label htmlFor="cnaes-secundarios" className="mt-4">CNAEs secundários (um por linha)</Label>
                <div className="relative">
                  <Textarea
                    id="cnaes-secundarios"
                    placeholder={"Ex.:\n47.62-0 - Comércio varejista de móveis\n95.12-8 - Reparação de equipamentos"}
                    ref={secondaryTextareaRef}
                    value={cnaesSecundarios.join("\n")}
                    onChange={(e) => {
                      // Unlock search once user edits after selecting
                      secondarySearchLockRef.current = false;
                      const raw = e.target.value;
                      const caret = e.target.selectionStart ?? raw.length;
                      setSecondaryCaretPos(caret);
                      const beforeCaret = raw.slice(0, caret);
                      const start = beforeCaret.lastIndexOf("\n") + 1;
                      const afterCaret = raw.slice(caret);
                      const nextNewline = afterCaret.indexOf("\n");
                      const end = nextNewline === -1 ? raw.length : caret + nextNewline;
                      const activeLine = raw.slice(start, end);
                      const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
                      setCnaesSecundarios(lines);
                      if (activeLine.trim()) {
                        fetchSecondaryCnaeSuggestions(activeLine);
                      } else {
                        setShowSecondaryCnaeSuggestions(false);
                        setSecondaryCnaeSuggestions([]);
                      }
                    }}
                    onClick={(e) => {
                      const raw = (e.target as HTMLTextAreaElement).value;
                      const caret = (e.target as HTMLTextAreaElement).selectionStart ?? raw.length;
                      setSecondaryCaretPos(caret);
                    }}
                    onKeyUp={(e) => {
                      const raw = (e.target as HTMLTextAreaElement).value;
                      const caret = (e.target as HTMLTextAreaElement).selectionStart ?? raw.length;
                      setSecondaryCaretPos(caret);
                      const beforeCaret = raw.slice(0, caret);
                      const start = beforeCaret.lastIndexOf("\n") + 1;
                      const afterCaret = raw.slice(caret);
                      const nextNewline = afterCaret.indexOf("\n");
                      const end = nextNewline === -1 ? raw.length : caret + nextNewline;
                      const activeLine = raw.slice(start, end);
                      if (activeLine.trim()) {
                        fetchSecondaryCnaeSuggestions(activeLine);
                      } else {
                        setShowSecondaryCnaeSuggestions(false);
                        setSecondaryCnaeSuggestions([]);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSecondaryCnaeSuggestions(false), 150);
                    }}
                  />
                  {showSecondaryCnaeSuggestions && secondaryCnaeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-background border rounded-md shadow z-50 max-h-48 overflow-y-auto">
                      {secondaryCnaeSuggestions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSecondaryCnaeSuggestion(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(coscipPrincipal || coscipSecondary.length > 0) && (
                  <div className="space-y-4 mt-2">
                    {coscipPrincipal && (
                      <div className={`border-l-4 p-3 rounded-md ${riskClasses(coscipPrincipal?.categoria)}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{coscipPrincipal.cnae || "—"} — {coscipPrincipal.descricao_cnae || "—"}</p>
                            <p className="text-sm mt-1">
                              <strong>Risco:</strong> {coscipPrincipal.categoria || "—"} &nbsp; | &nbsp;
                              <strong>Vistoria:</strong> {coscipPrincipal.vistoria || "—"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirEdicaoCnae('principal')}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                        {editCnaeTarget?.type === 'principal' && (
                          <div className="mt-3">
                            <Label htmlFor="selectRiscoPrincipal">Selecione novo risco</Label>
                            <select
                              id="selectRiscoPrincipal"
                              className="w-full border rounded-md h-10 px-3 bg-background"
                              value={editRiskSelection}
                              onChange={(e) => setEditRiskSelection(e.target.value)}
                            >
                              <option value="I">Risco I - Sem vistoria</option>
                              <option value="II">Risco II - Vistoria média</option>
                              <option value="III">Risco III - Vistoria completa</option>
                              <option value="IV">Risco IV - Alto risco</option>
                            </select>
                            <Button className="mt-2" variant="default" type="button" onClick={salvarEdicaoCnae}>Salvar</Button>
                          </div>
                        )}
                      </div>
                    )}
                    {coscipSecondary.map((m, idx) => (
                      <div key={idx} className={`border-l-4 p-3 rounded-md ${riskClasses(m.coscip_categoria)}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{m.cnae} — {m.descricao_cnae || "—"}</p>
                            <p className="text-sm mt-1">
                              <strong>Risco:</strong> {m.coscip_categoria || "—"} &nbsp; | &nbsp;
                              <strong>Vistoria:</strong> {m.vistoria || "—"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirEdicaoCnae('secondary', idx)}
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            ✏️ Editar
                          </button>
                        </div>
                        {editCnaeTarget?.type === 'secondary' && editCnaeTarget.index === idx && (
                          <div className="mt-3">
                            <Label htmlFor={`selectRiscoSec-${idx}`}>Selecione novo risco</Label>
                            <select
                              id={`selectRiscoSec-${idx}`}
                              className="w-full border rounded-md h-10 px-3 bg-background"
                              value={editRiskSelection}
                              onChange={(e) => setEditRiskSelection(e.target.value)}
                            >
                              <option value="I">Risco I - Sem vistoria</option>
                              <option value="II">Risco II - Vistoria média</option>
                              <option value="III">Risco III - Vistoria completa</option>
                              <option value="IV">Risco IV - Alto risco</option>
                            </select>
                            <Button className="mt-2" variant="default" type="button" onClick={salvarEdicaoCnae}>Salvar</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contactName">Nome completo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactName"
                    placeholder="Seu nome completo"
                    className="pl-10"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Telefone (WhatsApp) *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactPhone"
                    placeholder="(DDD) 90000-0000"
                    className="pl-10"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(formatPhoneBr(e.target.value))}
                    inputMode="tel"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Informe seu número do WhatsApp com DDD. Ex.: (81) 90000-0000</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contactEmail">E-mail do Responsável *</Label>
                  <Button type="button" variant="outline" size="icon" onClick={addEmailField} disabled={additionalEmails.length >= 3} title="Adicionar e-mail">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    className="pl-10"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                </div>
                {additionalEmails.map((email, idx) => (
                  <div key={idx} className="relative mt-2">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder={`E-mail adicional ${idx + 1}`}
                      className="pl-10"
                      value={email}
                      onChange={(e) => updateEmailField(idx, e.target.value)}
                    />
                  </div>
                ))}
                <p className="mt-1 text-xs text-muted-foreground">Você pode incluir até 3 e-mails adicionais.</p>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Endereço Completo *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  placeholder="Rua, número, complemento, bairro, cidade, estado, CEP"
                  className="pl-10 min-h-[100px]"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
            </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              📋 Próximos passos
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Após criar o processo, você poderá enviar documentos</li>
              <li>• A equipe do CBM-PE fará a análise e vistoria</li>
              <li>• Você acompanhará todo o andamento pela timeline</li>
            </ul>
          </div>
            </>
          )}

            {/* Passo 2: Taxa de Bombeiro */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">2. Taxa de Bombeiro</h3>
                <h4 className="text-base font-medium">🏙️ Escolha a cidade onde está localizado o seu estabelecimento</h4>
                <p className="text-sm text-muted-foreground">Selecione abaixo a cidade correspondente à localização do seu imóvel ou empresa.</p>

                <div className="space-y-2 rounded-xl border-2 border-blue-300/70 bg-blue-50/60 p-4">
                  <Label htmlFor="cidadeEstabelecimento">Cidade do estabelecimento *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-blue-600" />
                    <Select value={cidadeEstabelecimento} onValueChange={(v) => setCidadeEstabelecimento(v)}>
                      <SelectTrigger className="pl-10 h-10 text-sm border-2 border-blue-300 focus:ring-blue-500">
                        <SelectValue placeholder="Selecione uma cidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Recife">Recife</SelectItem>
                        <SelectItem value="Olinda">Olinda</SelectItem>
                        <SelectItem value="Jaboatão dos Guararapes">Jaboatão dos Guararapes</SelectItem>
                        <SelectItem value="Paulista">Paulista</SelectItem>
                        <SelectItem value="Camaragibe">Camaragibe</SelectItem>
                        <SelectItem value="Cabo de Santo Agostinho">Cabo de Santo Agostinho</SelectItem>
                        <SelectItem value="Igarassu">Igarassu</SelectItem>
                        <SelectItem value="Abreu e Lima">Abreu e Lima</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-blue-700">Obrigatório para calcular a DAM 20.</p>
                </div>
              </div>
            )}

            {/* Passo 3: Endereço */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">3. Endereço do Estabelecimento</h3>
                <p className="text-sm text-muted-foreground">Preencha os campos abaixo com o endereço completo do local para o qual está sendo solicitado o Atestado de Regularidade. Todos os campos marcados com * são obrigatórios.</p>

                <div className="rounded-xl border-2 border-blue-300/70 bg-blue-50/60 p-4 space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input
                      id="cep"
                      placeholder="00000-000"
                      value={cep}
                      onChange={(e) => {
                        const v = formatCep(e.target.value);
                        setCep(v);
                        if (!manualEdit) {
                          const clean = v.replace(/\D/g, "");
                          if (clean.length === 8) fetchViaCEP(clean);
                        }
                      }}
                      required
                      inputMode="numeric"
                    />
                    {cepError && <p className="text-xs text-red-600">{cepError}</p>}
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={buscarCep} disabled={loadingCep} className="bg-primary text-white">
                        {loadingCep ? (<><Loader2 className="mr-1 h-3 w-3 animate-spin" />Buscando</>) : 'Buscar CEP'}
                      </Button>
                      <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setManualEdit((v) => !v)}>
                        {manualEdit ? 'Desativar edição manual' : 'Editar manualmente'}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Ao informar 8 dígitos, você pode buscar na ViaCEP.</p>
                  </div>



                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="cidade">Cidade *</Label>
                    <Select value={cidade} onValueChange={(name) => {
                      setCidade(name);
                      const found = municipios.find((m) => m.nome === name);
                      setIbgeMunicipioId(found?.id ?? null);
                    }}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {municipios.map((m) => (
                          <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="logradouro">Logradouro *</Label>
                    <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero">Número *</Label>
                    <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} required />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bairro">Bairro *</Label>
                    <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="areaConstruida">Área construída (m²) {getGlobalRiskKey() !== 'I' ? '*' : ''}</Label>
                    <Input id="areaConstruida" type="number" min={0} value={areaConstruida as number | ''} onChange={(e) => setAreaConstruida(Number(e.target.value) || '')} required={getGlobalRiskKey() !== 'I'} />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoLogradouro">Tipo de logradouro</Label>
                    <Select value={tipoLogradouro} onValueChange={(v) => setTipoLogradouro(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rua">Rua</SelectItem>
                        <SelectItem value="Avenida">Avenida</SelectItem>
                        <SelectItem value="Travessa">Travessa</SelectItem>
                        <SelectItem value="Rodovia">Rodovia</SelectItem>
                        <SelectItem value="Praça">Praça</SelectItem>
                        <SelectItem value="Estrada">Estrada</SelectItem>
                        <SelectItem value="Alameda">Alameda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pontoReferencia">Ponto de referência</Label>
                    <Input id="pontoReferencia" value={pontoReferencia} onChange={(e) => setPontoReferencia(e.target.value)} placeholder="Ex.: Próximo ao Shopping X" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="areaTerreno">Área terreno (m²)</Label>
                    <Input id="areaTerreno" type="number" min={0} value={areaTerreno as number | ''} onChange={(e) => setAreaTerreno(Number(e.target.value) || '')} />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input id="latitude" type="number" step="0.000001" value={latitude as number | ''} onChange={(e) => setLatitude(Number(e.target.value) || '')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input id="longitude" type="number" step="0.000001" value={longitude as number | ''} onChange={(e) => setLongitude(Number(e.target.value) || '')} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={obterLocalizacao}>
                      Obter localização
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Possui acesso público</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="acessoPublico" value="sim" checked={acessoPublico === 'sim'} onChange={() => setAcessoPublico('sim')} />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="acessoPublico" value="nao" checked={acessoPublico === 'nao'} onChange={() => setAcessoPublico('nao')} />
                      <span>Não</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoesEndereco">Observações sobre o endereço</Label>
                  <Textarea id="observacoesEndereco" value={observacoesEndereco} onChange={(e) => setObservacoesEndereco(e.target.value)} placeholder="Informações adicionais relevantes sobre o endereço" />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipoImovel">Tipo de imóvel *</Label>
                    <Select value={tipoImovel} onValueChange={(v) => setTipoImovel(v as any)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residencial">Residencial</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="misto">Misto</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Possui edificação em mais de 1 pavimento?</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="multiPav" value="sim" checked={multiPavimentos === 'sim'} onChange={() => setMultiPavimentos('sim')} />
                        <span>Sim</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="multiPav" value="nao" checked={multiPavimentos === 'nao'} onChange={() => setMultiPavimentos('nao')} />
                        <span>Não</span>
                      </label>
                    </div>
                  </div>
                </div>

                {uf && uf !== 'PE' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-900">
                    ⚠️ Verifique se o endereço está dentro do estado de Pernambuco.
                  </div>
                )}
                <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-3 text-xs text-muted-foreground">
                  IBGE: {ibgeMunicipioId ? `Município ${ibgeMunicipioId}` : '—'} • UF: {uf || '—'} • CEP: {cep || '—'}
                </div>
                </div>
              </div>
            )}

            {/* Passo 4: Memorial Preliminar */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">4. Memorial Preliminar</h3>
                <p className="text-sm text-muted-foreground">Informe os dados técnicos referentes ao condomínio, ocupação e estrutura física do estabelecimento. Os campos marcados com * são de preenchimento obrigatório.</p>

                <div className="rounded-xl border-2 border-blue-300/70 bg-blue-50/60 p-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="riscoOcupacao">Risco da Ocupação *</Label>
                    <Select value={riscoOcupacao} onValueChange={(v) => setRiscoOcupacao(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="COMERCIAL">COMERCIAL</SelectItem>
                        <SelectItem value="INDUSTRIAL">INDUSTRIAL</SelectItem>
                        <SelectItem value="RESIDENCIAL">RESIDENCIAL</SelectItem>
                        <SelectItem value="PÚBLICA">PÚBLICA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="areaTotalConstruida">Área Construída Declarada (m²) *</Label>
                    <Input id="areaTotalConstruida" type="number" step="0.01" min={0} value={areaTotalConstruida as number | ''} onChange={(e) => setAreaTotalConstruida(Number(e.target.value) || '')} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>É condomínio? *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condominio" value="sim" checked={isCondominio === 'sim'} onChange={() => setIsCondominio('sim')} required />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condominio" value="nao" checked={isCondominio === 'nao'} onChange={() => setIsCondominio('nao')} required />
                      <span>Não</span>
                    </label>
                  </div>
                  {isCondominio === 'sim' && (
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="condominioNome">Nome do condomínio</Label>
                        <Input id="condominioNome" value={condominioNome} onChange={(e) => setCondominioNome(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="condominioDoc">CNPJ/CPF do condomínio</Label>
                        <Input id="condominioDoc" value={condominioDoc} onChange={(e) => handleCondominioDocChange(e.target.value)} placeholder="00.000.000/0000-00 ou 000.000.000-00" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="alturaEdificacao">Altura da Edificação (m) *</Label>
                    <Input id="alturaEdificacao" type="number" min={0} value={alturaEdificacao as number | ''} onChange={(e) => setAlturaEdificacao(Number(e.target.value) || '')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qtdPavimentos">Número de pavimentos (inclui térreo e mezanino) *</Label>
                    <Input id="qtdPavimentos" type="number" min={0} value={qtdPavimentos as number | ''} onChange={(e) => setQtdPavimentos(Number(e.target.value) || '')} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacidadeFisica">Capacidade Física, Pessoas *</Label>
                    <Input id="capacidadeFisica" type="number" min={0} value={capacidadeFisica as number | ''} onChange={(e) => setCapacidadeFisica(Number(e.target.value) || '')} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tem central de gás (GLP) instalada? *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="glp" value="sim" checked={centralGLPInstalada === 'sim'} onChange={() => setCentralGLPInstalada('sim')} required />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="glp" value="nao" checked={centralGLPInstalada === 'nao'} onChange={() => setCentralGLPInstalada('nao')} required />
                      <span>Não</span>
                    </label>
                  </div>
                  {centralGLPInstalada === 'sim' && (
                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="numBotijoesGLP">Nº de botijões de gás (GLP) (Kg)</Label>
                        <Input id="numBotijoesGLP" type="number" min={0} value={numBotijoesGLP as number | ''} onChange={(e) => setNumBotijoesGLP(Number(e.target.value) || '')} />
                      </div>
                      <div className="space-y-2">
                        <Label>O ponto de gás existe?</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-2">
                            <input type="radio" name="pontoGas" value="sim" checked={pontoGasExiste === 'sim'} onChange={() => setPontoGasExiste('sim')} />
                            <span>Sim</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" name="pontoGas" value="nao" checked={pontoGasExiste === 'nao'} onChange={() => setPontoGasExiste('nao')} />
                            <span>Não</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trabalha com explosivos ou produtos perigosos? *</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="explosivos" value="sim" checked={trabalhaExplosivos === 'sim'} onChange={() => setTrabalhaExplosivos('sim')} required />
                        <span>Sim</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="explosivos" value="nao" checked={trabalhaExplosivos === 'nao'} onChange={() => setTrabalhaExplosivos('nao')} required />
                        <span>Não</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Existe sistema fixo? *</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="sistemaFixo" value="sim" checked={existeSistemaFixo === 'sim'} onChange={() => setExisteSistemaFixo('sim')} required />
                        <span>Sim</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="sistemaFixo" value="nao" checked={existeSistemaFixo === 'nao'} onChange={() => setExisteSistemaFixo('nao')} required />
                        <span>Não</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numeroProjeto">Número do Projeto no Memorial Aprovado ou Termo de Permissão</Label>
                    <Input id="numeroProjeto" value={numeroProjeto} onChange={(e) => setNumeroProjeto(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observacoesGerais">Observações Gerais</Label>
                    <Textarea id="observacoesGerais" value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} placeholder="Informações adicionais" />
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-900">
                  Se não possuir projeto de segurança aprovado, deverá providenciar a confecção do projeto de segurança do estabelecimento e voltar ao portal...
                </div>
                </div>
              </div>
            )}

            {/* Passo 5: Finalização */}
            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">5. Finalização</h3>
                <p className="text-sm text-muted-foreground">Revise os dados finais, aceite o termo e gere o boleto, se aplicável.</p>

                {/* Resumo read-only */}
                <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo de Risco do Imóvel</p>
                      <p className="font-medium">{(() => { const k = getGlobalRiskKey(); return k === 'I' ? 'BAIXO' : k === 'II' ? 'MÉDIO' : k === 'III' ? 'ALTO' : k === 'IV' ? 'MUITO ALTO' : '—'; })()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Isenção de Pagamento</p>
                      <p className="font-medium">{isento ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor da Taxa</p>
                      <p className="font-medium">R$ {Number(taxaValor || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo de taxa</p>
                      <p className="font-medium">Taxa de Atestado de Regularidade</p>
                    </div>
                  </div>
                </div>

                {/* Junto de Pagamento? */}
                <div className="space-y-2">
                  <Label>Junto de Pagamento? *</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="juntoPagamento" value="sim" checked={juntoPagamento === 'sim'} onChange={() => setJuntoPagamento('sim')} required />
                      <span>Sim</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="juntoPagamento" value="nao" checked={juntoPagamento === 'nao'} onChange={() => setJuntoPagamento('nao')} required />
                      <span>Não</span>
                    </label>
                  </div>
                </div>

                {/* Termo de Responsabilidade */}
                <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <input id="termoResp" type="checkbox" className="mt-1 h-4 w-4" checked={termoResponsabilidadeAceito} onChange={(e) => setTermoResponsabilidadeAceito(e.target.checked)} required />
                    <div>
                      <Label htmlFor="termoResp">Termo de Responsabilidade *</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Declaro, sob responsabilidade, que as informações prestadas são verdadeiras e que estou ciente das obrigações legais referentes à segurança contra incêndio e pânico.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mensagens informativas */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-900">
                  <p>Obs.: O processo só poderá entrar em avaliação no máximo 3 vezes e ultrapassado o limite, será necessária nova solicitação (CODSCIP).</p>
                  <p className="mt-2">Obs.: Com todas as informações inseridas corretamente, clique em Gerar Boleto para emitir a guia de pagamento.</p>
                </div>

                {/* Bloco de pagamento automático */}
                {!isento && (
                  <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3">Pagamento</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Valor a pagar:</span>
                        <span className="font-medium">R$ {Number(taxaValor || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tipo de taxa:</span>
                        <span className="font-medium">Taxa de Atestado de Regularidade</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="mt-3 w-full"
                      onClick={async () => {
                        // Gera QR se não existir
                        let qrUrl = qrDataUrl;
                        const valor = Number(taxaValor || 0);
                        if (!qrUrl) {
                          try {
                            qrUrl = await QRCode.toDataURL(`pix://pagamento?valor=${valor}`);
                          } catch {}
                        }
                        const code = referenceCode || `CBMPE-${getGlobalRiskKey() || 'X'}-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14)}`;
                        const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Boleto - Taxa de Atestado</title><style>body{font-family:Arial, sans-serif;padding:24px} .box{border:1px solid #ddd;border-radius:8px;padding:16px;margin-top:8px} .row{display:flex;justify-content:space-between;margin:8px 0} .qr{margin-top:12px;text-align:center}</style></head><body><h2>Boleto de Pagamento</h2><div class="box"><div class="row"><span>Valor da taxa</span><strong>R$ ${valor.toFixed(2)}</strong></div><div class="row"><span>Solicitante</span><strong>${companyName || '-'}</strong></div><div class="row"><span>CPF/CNPJ</span><strong>${String(cnpj || '').replace(/\D/g,'')}</strong></div><div class="row"><span>Código do processo</span><strong>${code}</strong></div><div class="row"><span>Status</span><strong>Aguardando Pagamento</strong></div><div class="qr"><img alt="QR Code" src="${qrUrl || ''}" style="width:160px;height:160px"/></div></div></body></html>`;
                        const base64 = btoa(unescape(encodeURIComponent(html)));
                        const url = `data:text/html;base64,${base64}`;
                        setBoletoUrl(url);
                        setBoletoGerado(true);
                        window.open(url, "_blank");
                        toast({ title: "Boleto gerado", description: "Boleto mockado aberto em nova aba." });
                      }}
                    >
                      Gerar Boleto
                    </Button>
                  </div>
                )}

                {/* Status orientativo */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {isento
                    ? "Processo isento. Conclua a solicitação para registrar no sistema."
                    : boletoGerado
                      ? "Boleto gerado. Conclua a solicitação para registrar e vincular ao processo."
                      : "Gere o boleto para prosseguir ou conclua se isento."}
                </div>
              </div>
            )}

          {/* Navegação */}
          <div className="mt-4 flex gap-2 justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
              disabled={wizardStep === 0}
            >
              Voltar
            </Button>
            <Button
                  type="button"
                  className="bg-gradient-primary"
                  onClick={() => {
                    const basicValid = validateCurrentStep();
                    if (!basicValid) return;
                    if (wizardStep === 2) {
                      const ok = validateAddressStep();
                      if (!ok) return;
                    }
                    if (wizardStep === 3) {
                      const ok2 = validateMemorialStep();
                      if (!ok2) return;
                    }
                    if (wizardStep === 1 && !cidadeEstabelecimento) {
                      toast({
                        title: "Selecione a cidade",
                        description: "Escolha a cidade do estabelecimento para continuar.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setWizardStep((prev) => {
                      const next = Math.min(steps.length - 1, prev + 1);
                      return next;
                    });
                  }}
                  disabled={wizardStep === steps.length - 1}
                >
                  Avançar
                </Button>
          </div>

          {/* Submit Button */}
          <Button
              type="submit"
              className="w-full bg-gradient-primary"
              size="lg"
              disabled={loading || wizardStep !== steps.length - 1 || !termoResponsabilidadeAceito || !juntoPagamento || ((getGlobalRiskKey() !== "I") && !(isento || boletoGerado))}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Concluir Solicitação"
              )}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default NovoProcesso;
