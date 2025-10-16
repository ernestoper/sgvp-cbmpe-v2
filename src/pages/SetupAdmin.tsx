import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SetupAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const createAdminUser = async () => {
    setLoading(true);

    try {
      // Criar admin user através do signup
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: "admin@cbm.pe.gov.br",
        password: "Admin@CBM2025",
        options: {
          data: {
            full_name: "Administrador CBM-PE",
            role: "admin",
          },
          emailRedirectTo: `${window.location.origin}/dashboard/admin`,
        },
      });

      if (signupError) throw signupError;

      setSuccess(true);
      toast({
        title: "Admin criado com sucesso!",
        description: "Você já pode fazer login com as credenciais fornecidas.",
      });

      setTimeout(() => {
        navigate("/login/admin");
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Erro ao criar admin",
        description: error.message || "Não foi possível criar o usuário admin.",
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Configuração Inicial</h1>
          <p className="text-white/80">Criar primeiro usuário administrador</p>
        </div>

        <Card className="p-6 bg-white/95 backdrop-blur-sm">
          {!success ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-semibold mb-2">
                  📋 Credenciais do Admin
                </p>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><strong>E-mail:</strong> admin@cbm.pe.gov.br</p>
                  <p><strong>Senha:</strong> Admin@CBM2025</p>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="mb-2">Este processo irá:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Criar o primeiro usuário administrador</li>
                  <li>Configurar as permissões necessárias</li>
                  <li>Habilitar acesso ao painel administrativo</li>
                </ul>
              </div>

              <Button
                onClick={createAdminUser}
                className="w-full bg-gradient-primary"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Criando admin...
                  </>
                ) : (
                  "Criar Usuário Admin"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                ⚠️ Execute este processo apenas uma vez
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Admin Criado!</h3>
              <p className="text-muted-foreground mb-4">
                Redirecionando para página de login...
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SetupAdmin;
