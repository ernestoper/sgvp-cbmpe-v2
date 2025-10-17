import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, FileText } from "lucide-react";
import { AppHeaderLogo } from "@/components/AppHeaderLogo";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";

interface Process {
  id: string;
  process_number: string;
  company_name: string;
  current_status: string;
  created_at: string;
}

const DashboardUsuario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [processes, setProcesses] = useState<Process[]>([]);

  useEffect(() => {
    checkUser();
    fetchProcesses();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login/usuario");
      return;
    }
    setUser(user);
  };

  const fetchProcesses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await dynamodb.processes.getByUserId(user.id);
      
      // Sort by created_at descending
      const processList = (data || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setProcesses(processList);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar processos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <AppHeaderLogo />
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Meus Processos</h2>
            <p className="text-muted-foreground mt-1">
              Acompanhe o andamento das suas solicitações
            </p>
          </div>
          <Button 
            size="lg" 
            className="bg-gradient-primary"
            onClick={() => navigate("/processo/novo")}
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Solicitação de Vistoria
          </Button>
        </div>

        {processes.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum processo cadastrado</h3>
            <p className="text-muted-foreground mb-6">
              Comece criando sua primeira solicitação de vistoria
            </p>
            <Button 
              className="bg-gradient-primary"
              onClick={() => navigate("/processo/novo")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Processo
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {processes.map((process) => (
              <Card 
                key={process.id} 
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/processo/${process.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        Processo {process.process_number}
                      </h3>
                      <StatusBadge status={process.current_status as any} />
                    </div>
                    <p className="text-muted-foreground mb-1">{process.company_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Criado em {new Date(process.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button variant="ghost">Ver Detalhes</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardUsuario;
