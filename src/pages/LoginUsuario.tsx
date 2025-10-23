import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";

const LoginUsuario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupCNPJ, setSignupCNPJ] = useState("");
  const [signupCompanyName, setSignupCompanyName] = useState("");
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
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
    setSignupCNPJ(formatted);
  };

  const fetchCNPJData = async () => {
    const cleanCNPJ = signupCNPJ.replace(/\D/g, "");
    
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
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      
      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data = await response.json();
      setSignupCompanyName(data.razao_social || data.nome_fantasia || "");

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log("=== INICIANDO LOGIN ===");
    console.log("Email:", loginEmail);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      console.log("Resposta do Supabase:", { data, error });
      console.log("Data completo:", JSON.stringify(data, null, 2));
      console.log("Error completo:", JSON.stringify(error, null, 2));

      if (error) {
        console.error("Erro no login:", error);
        throw error;
      }

      if (data.user) {
        console.log("Usuário logado:", data.user);
        console.log("Email confirmado:", data.user.email_confirmed_at);
        
        // Check if user is admin using user_roles table
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roles) {
          toast({
            title: "Acesso negado",
            description: "Use o login de admin para acessar o sistema.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao SGVP.",
        });
        navigate("/dashboard/usuario");
      }
    } catch (error: any) {
      console.error("=== ERRO NO LOGIN ===");
      console.error("Código:", error.code);
      console.error("Mensagem:", error.message);
      console.error("Detalhes:", error);
      
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log("=== FIM DO LOGIN ===");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log("=== INICIANDO CADASTRO DE USUÁRIO ===");
    console.log("Dados do formulário:", {
      email: signupEmail,
      fullName: signupFullName,
      cnpj: signupCNPJ,
      companyName: signupCompanyName,
      passwordLength: signupPassword.length
    });

    try {
      console.log("1. Tentando criar usuário no Supabase...");
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            full_name: signupFullName,
            role: "user",
            cnpj: signupCNPJ,
            company_name: signupCompanyName,
          },
          emailRedirectTo: `${window.location.origin}/dashboard/usuario`,
        },
      });

      if (error) {
        console.error("Erro no Supabase:", error);
        throw error;
      }

      console.log("2. Usuário criado no Supabase com sucesso:", {
        userId: data.user?.id,
        email: data.user?.email,
        metadata: data.user?.user_metadata
      });

      if (data.user) {
        console.log("3. Exibindo toast de sucesso e redirecionando para login");
        toast({
          title: "Cadastro realizado!",
          description: "Você já pode fazer login no sistema.",
        });
        
        // Trocar automaticamente para a aba de Login e preencher o e-mail
        setActiveTab("login");
        setLoginEmail(signupEmail);
        setLoginPassword("");
        
        console.log("4. Cadastro concluído com sucesso!");
      }
    } catch (error: any) {
      console.error("=== ERRO NO CADASTRO ===");
      console.error("Tipo do erro:", typeof error);
      console.error("Mensagem:", error.message);
      console.error("Código:", error.code);
      console.error("Detalhes completos:", error);
      
      toast({
        title: "Erro no cadastro",
        description: error.message || "Não foi possível criar sua conta.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log("=== FIM DO PROCESSO DE CADASTRO ===");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero igual ao da página inicial */}
      <section className="relative bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] overflow-hidden">
        <img
          src="https://img.freepik.com/fotos-premium/bombeiro-usando-agua-e-extintor-para-lutar_327072-8700.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-50 md:opacity-60 mix-blend-overlay pointer-events-none select-none"
          style={{ objectPosition: 'center 8%' }}
          loading="lazy"
          decoding="async"
        />
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 md:py-10">
          {/* Apenas a coluna esquerda (logo + textos) */}
          <div className="flex items-center justify-center gap-4 md:gap-6">
            <motion.img
              src="https://upload.wikimedia.org/wikipedia/commons/7/7c/NOVO_BRAS%C3%83O_2024_CBMPE.png"
              alt="Brasão do Corpo de Bombeiros Militar de Pernambuco"
              className="w-28 h-28 md:w-32 md:h-32 object-contain rounded-full bg-white/95 shadow-sm"
              loading="lazy"
              decoding="async"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
            <div className="text-center">
              <motion.h1
                className="text-2xl md:text-3xl font-bold text-white"
                style={{ fontFamily: "Poppins, Inter, sans-serif" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                SGVP – CBM/PE
              </motion.h1>
              <motion.p
                className="text-base md:text-lg text-white/90"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              >
                Sistema de Gestão de Vistorias e Processos
              </motion.p>
              <motion.p
                className="text-sm md:text-base text-white/80 mt-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
              >
                Corpo de Bombeiros Militar de Pernambuco
              </motion.p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de login */}
      <section className="w-full max-w-6xl mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link 
              to="/" 
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Link>
          </div>
          <h2 className="text-center text-foreground text-lg md:text-xl font-semibold mb-4">
            Portal do Cidadão
          </h2>

          {/* Credenciais de Teste */}
          <Card className="p-4 bg-blue-50 border-blue-200 mb-4">
            <div className="text-sm space-y-2">
              <p className="font-semibold text-blue-900 flex items-center gap-2">
                🔑 Credenciais de Teste
              </p>
              <div className="text-blue-800 space-y-1 font-mono">
                <p><strong>E-mail:</strong> teste@teste.com</p>
                <p><strong>Senha:</strong> 123456</p>
              </div>
              <p className="text-xs text-blue-700 mt-2">
                💡 Use essas credenciais para testar o sistema
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Cadastro</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] text-white hover:opacity-90 focus:ring-2 focus:ring-[#0D3C61]/40"
                    disabled={loading}
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Seu nome completo"
                        className="pl-10"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        className="pl-10"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-cnpj">CNPJ (opcional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="signup-cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={signupCNPJ}
                        onChange={(e) => handleCNPJChange(e.target.value)}
                        maxLength={18}
                      />
                      <Button
                        type="button"
                        onClick={fetchCNPJData}
                        disabled={loadingCNPJ || signupCNPJ.replace(/\D/g, "").length !== 14}
                        variant="outline"
                      >
                        {loadingCNPJ ? "..." : "Buscar"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clique em "Buscar" para preencher o nome da empresa
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-company">Nome da Empresa (opcional)</Label>
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Razão social"
                      value={signupCompanyName}
                      onChange={(e) => setSignupCompanyName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] text-white hover:opacity-90 focus:ring-2 focus:ring-[#0D3C61]/40"
                    disabled={loading}
                  >
                    {loading ? "Criando conta..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </section>

      {/* Rodapé opcional pode ser adicionado conforme necessário */}
    </div>
  );
};

export default LoginUsuario;
