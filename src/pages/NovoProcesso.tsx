import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, ArrowLeft, Building2, FileText, MapPin, Loader2, User, Phone, Mail } from "lucide-react";
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

      toast({
        title: "Processo criado!",
        description: `Processo ${processNumber} criado com sucesso.`,
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Novo Processo</h1>
              <p className="text-sm text-muted-foreground">Solicite uma vistoria</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
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
