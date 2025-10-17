import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ArrowLeft, Building2, FileText, MapPin, Loader2, User, Phone, Mail, Plus, QrCode, CheckCircle } from "lucide-react";
import { AppHeaderLogo } from "@/components/AppHeaderLogo";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { getCOSCIPbyCNAE } from "@/lib/coscip";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

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
    const code = cnaePrincipal.replace(/\D/g, "");
    if (!code || code.length < 4) {
      setCoscipPrincipal(null);
      return;
    }
    let active = true;
    (async () => {
      const res = await getCOSCIPbyCNAE(code);
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
    const s = String(cat || "").toLowerCase();
    if (!s) return null;
    if (/(^|\s)i(\s|$)/.test(s) || s.includes("risco i") || s.includes("baixo")) return "I";
    if (/(^|\s)ii(\s|$)/.test(s) || s.includes("risco ii") || s.includes("médio") || s.includes("medio")) return "II";
    if (/(^|\s)iii(\s|$)/.test(s) || s.includes("risco iii")) return "III";
    if (/(^|\s)iv(\s|$)/.test(s) || s.includes("risco iv") || s.includes("alto")) return "IV";
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
      }> = [];
      for (const s of cnaesSecundarios) {
        const code = String(s || "").replace(/\D/g, "");
        if (!code) continue;
        const it = await getCOSCIPbyCNAE(code);
        mapped.push({
          cnae: code,
          descricao_cnae: it?.descricao_cnae,
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
    { key: "ocupacao", label: "Ocupação" },
    { key: "taxa", label: "Taxa de Bombeiro" },
    { key: "endereco", label: "Endereço" },
    { key: "memorial", label: "Memorial Preliminar" },
    { key: "documentos", label: "Documentos" },
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

  const handleTimelineClick = (i: number) => {
    // Se estiver avançando, valida os campos obrigatórios do passo atual
    if (i > wizardStep) {
      const valid = validateCurrentStep();
      if (!valid) return;
    }
    if (i > 1 && !paymentCompleted) {
      toast({
        title: "Finalize o pagamento",
        description: "Clique em 'Confirmar pagamento' para prosseguir.",
      });
      setWizardStep(1);
      return;
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

  const sendWhatsAppNotification = async (phone: string, processNumber: string, companyName: string, contactName: string) => {
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

🌐 *Acesse:* ${window.location.origin}/processo/${processNumber}

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
        current_status: "cadastro",
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
      const processData = {
        user_id: user.id,
        process_number: processNumber,
        company_name: companyName,
        cnpj: cnpj.replace(/\D/g, ""),
        address: address,
        current_status: "cadastro" as const,
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

      // Enviar WhatsApp de confirmação
      await sendWhatsAppNotification(phoneDigits, processNumber, companyName, contactName.trim());

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
                {!paymentCompleted ? (
                  <div className="bg-muted/30 border border-muted-foreground/20 rounded-lg p-4 flex flex-col items-center">
                    <p className="text-sm"><span className="font-medium">Valor Simulado:</span> R$ {Number(taxaValor || 0).toFixed(2)}</p>
                    <p className="text-sm"><span className="font-medium">Status:</span> {paymentCompleted ? "Boleto pago" : "Aguardando pagamento"}</p>
                    <div className="w-48 h-48 bg-white border rounded-md flex items-center justify-center overflow-hidden">
                      {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code Pix" className="w-44 h-44" />
                      ) : (
                        <QrCode className="w-32 h-32 text-muted-foreground" />
                      )}
                    </div>
                    {referenceCode && (
                      <p className="text-xs text-muted-foreground mt-2"><span className="font-medium">Código de Referência:</span> {referenceCode}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">Use o QR Code para pagar via Pix.</p>
                    {Number(taxaValor || 0) === 0 ? (
                      <Button className="mt-3" onClick={() => { setPaymentCompleted(true); setWizardStep((prev) => Math.min(prev + 1, 4)); }} disabled={processingPayment}>
                        {processingPayment ? "Processando..." : "Confirmar isenção"}
                      </Button>
                    ) : (
                      <Button className="mt-3" onClick={simulatePayment} disabled={processingPayment}>
                        {processingPayment ? "Processando pagamento..." : "Confirmar pagamento"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-green-800">Pagamento efetuado com sucesso.</p>
                  </div>
                )}
              </div>
            )}

            {/* Passo 3: Endereço */}
            {wizardStep === 2 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">3. Endereço</h3>
                <p className="text-sm text-muted-foreground">Informe e confirme o endereço do imóvel.</p>
              </div>
            )}

            {/* Passo 4: Memorial Preliminar */}
            {wizardStep === 3 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">4. Memorial Preliminar</h3>
                <p className="text-sm text-muted-foreground">Conteúdo do memorial preliminar será inserido aqui.</p>
              </div>
            )}

            {/* Passo 5: Documentos */}
            {wizardStep === 4 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">5. Documentos</h3>
                <p className="text-sm text-muted-foreground">Envio de documentos será disponibilizado nesta etapa.</p>
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
                    const valid = validateCurrentStep();
                    if (!valid) return;
                    setWizardStep((prev) => {
                      const next = Math.min(steps.length - 1, prev + 1);
                      if (next > 1 && !paymentCompleted) return 1;
                      return next;
                    });
                  }}
                  disabled={wizardStep === steps.length - 1 || (wizardStep === 1 && !paymentCompleted)}
                >
                  Avançar
                </Button>
          </div>

          {/* Submit Button */}
          <Button
              type="submit"
              className="w-full bg-gradient-primary"
              size="lg"
              disabled={loading || wizardStep !== steps.length - 1}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Processo"
              )}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default NovoProcesso;
