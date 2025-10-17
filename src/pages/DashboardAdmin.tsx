import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogOut, FileText, Search, Filter, TrendingUp, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { useRole } from "@/hooks/useRole";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Process {
  id: string;
  process_number: string;
  company_name: string;
  cnpj: string;
  current_status: string;
  created_at: string;
  user_id: string;
}

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, loading: roleLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Simplified statistics
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
  });

  useEffect(() => {
    if (!roleLoading) {
      if (role !== "admin") {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      checkAuth();
      fetchProcesses();
    }
  }, [roleLoading, role]);

  useEffect(() => {
    filterProcesses();
  }, [searchTerm, statusFilter, processes]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login/admin");
    }
  };

  const fetchProcesses = async () => {
    try {
      const data = await dynamodb.processes.getAll();
      
      // Sort by created_at descending
      const processList = (data || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setProcesses(processList);
      calculateStats(processList);
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

  const calculateStats = (processList: Process[]) => {
    const total = processList.length;
    const completed = processList.filter(p => p.current_status === "concluido").length;
    const onHold = processList.filter(p => p.current_status === "exigencia").length;
    const inProgress = processList.filter(p => 
      !["concluido", "exigencia"].includes(p.current_status)
    ).length;

    setStats({ total, inProgress, completed, onHold });
  };

  const filterProcesses = () => {
    let filtered = processes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (process) =>
          process.process_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          process.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          process.cnpj.includes(searchTerm)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((process) => process.current_status === statusFilter);
    }

    setFilteredProcesses(filtered);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/7/7c/NOVO_BRAS%C3%83O_2024_CBMPE.png"
              alt="Corpo de Bombeiro Militar de Pernambuco"
              className="w-20 h-20 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">SGVP - CBM/PE</h1>
              <p className="text-sm text-muted-foreground">Painel Administrativo</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Processos</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Em Andamento</p>
                <p className="text-3xl font-bold">{stats.inProgress}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Concluídos</p>
                <p className="text-3xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Em Exigência</p>
                <p className="text-3xl font-bold">{stats.onHold}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, empresa ou CNPJ..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="cadastro">Cadastro</SelectItem>
              <SelectItem value="triagem">Triagem</SelectItem>
              <SelectItem value="vistoria">Vistoria</SelectItem>
              <SelectItem value="comissao">Comissão</SelectItem>
              <SelectItem value="aprovacao">Aprovação</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="exigencia">Exigência</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Processes List */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            Processos ({filteredProcesses.length})
          </h2>

          {filteredProcesses.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum processo encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Aguardando novos processos"}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredProcesses.map((process) => (
                <Card
                  key={process.id}
                  className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/admin/processo/${process.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          Processo {process.process_number}
                        </h3>
                        <StatusBadge status={process.current_status as any} />
                      </div>
                      <p className="text-muted-foreground mb-1 font-medium">
                        {process.company_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        CNPJ: {process.cnpj}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Criado em {new Date(process.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button variant="default" size="sm">
                      Ver Detalhes
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardAdmin;
