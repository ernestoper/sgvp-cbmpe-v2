import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ArrowLeft, Building2, FileText, MapPin, Loader2, User, Phone, Mail } from "lucide-react";
import { AppHeaderLogo } from "@/components/AppHeaderLogo";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { useToast } from "@/hooks/use-toast";

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

  // Wizard timeline (visual only, não altera o formulário existente)
  const steps = [
    { key: "ocupacao", label: "Ocupação" },
    { key: "taxa", label: "Taxa de Bombeiro" },
    { key: "endereco", label: "Endereço" },
    { key: "memorial", label: "Memorial Preliminar" },
    { key: "documentos", label: "Documentos" },
  ];
  const [wizardStep, setWizardStep] = useState(0);

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
      };

      const result = await dynamodb.processes.create(processData);
      const processId = result.id;

      // Create initial history entry
      await dynamodb.history.create({
        process_id: processId,
        status: "cadastro",
        step_status: "completed",
        observations: `Processo criado pelo usuário — Contato: ${contactName.trim()} | ${formatPhoneBr(phoneDigits)} | ${contactEmail.trim()}`,
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
        {/* Timeline horizontal dos 5 passos (visual e navegável) */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <ol className="flex items-center">
                {steps.map((s, i) => {
                  const isCompleted = i < wizardStep;
                  const isCurrent = i === wizardStep;
                  const circleClasses = isCurrent
                    ? "bg-primary text-white"
                    : isCompleted
                      ? "bg-primary/80 text-white"
                      : "bg-muted text-muted-foreground";
                  const labelClasses = isCurrent
                    ? "text-primary font-medium"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground";
                  return (
                    <li key={s.key} className="flex items-center">
                      <button
                        type="button"
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${circleClasses}`}
                        aria-current={isCurrent ? "step" : undefined}
                        onClick={() => setWizardStep(i)}
                        title={s.label}
                      >
                        {i + 1}
                      </button>
                      <span className={`ml-2 ${labelClasses}`}>{s.label}</span>
                      {i < steps.length - 1 && (
                        <span className="mx-4 h-px w-16 bg-muted" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
            {/* Controles de navegação movidos para o final do formulário */}
          </div>
          {/* Resumo das informações já preenchidas (sempre visível) */}
          <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground">CNPJ</p>
              <p className="font-medium">{cnpj || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Empresa</p>
              <p className="font-medium">{companyName || "—"}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-muted-foreground">Endereço</p>
              <p className="font-medium">{address || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">CNAE principal</p>
              <p className="font-medium">{cnaePrincipal || "—"}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-muted-foreground">CNAEs secundários</p>
              <p className="font-medium">
                {cnaesSecundarios.length ? cnaesSecundarios.join(", ") : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Responsável</p>
              <p className="font-medium">{contactName || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Telefone</p>
              <p className="font-medium">{contactPhone || "—"}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-muted-foreground">E-mail</p>
              <p className="font-medium">{contactEmail || "—"}</p>
            </div>
          </div>
          {/* Navegação da timeline (rodapé do card) */}
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
              onClick={() => setWizardStep((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={wizardStep === steps.length - 1}
            >
              Avançar
            </Button>
          </div>
        </Card>
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CNPJ Field */}
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
              <div className="grid md:grid-cols-2 gap-4 text-sm mt-2">
                <div className="space-y-2">
                  <Label htmlFor="cnae-principal">CNAE principal</Label>
                  <Input
                    id="cnae-principal"
                    placeholder="Ex.: 47.89-0 - Comércio varejista de..."
                    value={cnaePrincipal}
                    onChange={(e) => setCnaePrincipal(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="cnaes-secundarios">CNAEs secundários (um por linha)</Label>
                  <Textarea
                    id="cnaes-secundarios"
                    placeholder={"Ex.:\n47.62-0 - Comércio varejista de móveis\n95.12-8 - Reparação de equipamentos"}
                    value={cnaesSecundarios.join("\n")}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setCnaesSecundarios(lines);
                    }}
                  />
                </div>
              </div>
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
                <Label htmlFor="contactEmail">E-mail *</Label>
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


          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-gradient-primary"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Criando processo...
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
