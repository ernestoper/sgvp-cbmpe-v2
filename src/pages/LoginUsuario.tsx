import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      if (data.user) {
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
      toast({
        title: "Erro no login",
        description: error.message || "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Cadastro realizado!",
          description: "Você já pode fazer login no sistema.",
        });
        // Trocar automaticamente para a aba de Login e preencher o e-mail
        setActiveTab("login");
        setLoginEmail(signupEmail);
        setLoginPassword("");
      }
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message || "Não foi possível criar sua conta.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Link>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Portal do Cidadão</h1>
          <p className="text-white/80">SGVP - CBM/PE</p>
        </div>

        <Card className="p-6 bg-white/95 backdrop-blur-sm">
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
                  className="w-full bg-gradient-primary"
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
                  className="w-full bg-gradient-primary"
                  disabled={loading}
                >
                  {loading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default LoginUsuario;
