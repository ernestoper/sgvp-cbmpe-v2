import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const LoginAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if user is admin using user_roles table
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (rolesError) throw rolesError;

        if (!roles) {
          toast({
            title: "Acesso negado",
            description: "Você não possui permissão de administrador.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao painel administrativo.",
        });
        navigate("/dashboard/admin");
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

      {/* Seção de login admin */}
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
          <h2 className="text-center text-foreground text-lg md:text-xl font-semibold">Painel Administrativo</h2>
          <p className="text-center text-muted-foreground mb-4">Acesso restrito - CBM/PE</p>

          {/* Credenciais Temporárias */}
          <Card className="p-4 bg-yellow-50 border-yellow-200 mb-4">
            <div className="text-sm space-y-2">
              <p className="font-semibold text-yellow-900 flex items-center gap-2">
                🔑 Credenciais Temporárias de Admin
              </p>
              <div className="text-yellow-800 space-y-1 font-mono">
                <p><strong>E-mail:</strong> admin@cbm.pe.gov.br</p>
                <p><strong>Senha:</strong> Admin@CBM2025</p>
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                ⚠️ Por segurança, altere a senha após o primeiro acesso
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-white">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Institucional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="bombeiro@cbm.pe.gov.br"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] text-white hover:opacity-90 focus:ring-2 focus:ring-[#0D3C61]/40"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Acessar Sistema"}
              </Button>

              <div className="text-sm text-center text-muted-foreground pt-2">
                <p>⚠️ Área restrita para bombeiros autorizados</p>
              </div>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default LoginAdmin;
