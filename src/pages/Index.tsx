import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, User, FileCheck } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo & Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm mb-6 shadow-xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            SGVP - CBM/PE
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Sistema de Gestão de Vistorias e Processos
          </p>
          <p className="text-lg text-white/80 mt-2">
            Corpo de Bombeiros Militar de Pernambuco
          </p>
        </div>

        {/* Cards de Acesso */}
        <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl animate-scale-in">
          <Card 
            className="p-8 bg-white/95 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group border-2 hover:border-primary"
            onClick={() => navigate("/login/usuario")}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Sou Cidadão/Empresa
              </h2>
              <p className="text-muted-foreground">
                Acesse para solicitar vistorias, acompanhar processos e enviar documentos
              </p>
              <Button 
                size="lg" 
                className="w-full bg-gradient-primary hover:shadow-lg transition-all"
              >
                Acessar como Usuário
              </Button>
            </div>
          </Card>

          <Card 
            className="p-8 bg-white/95 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer group border-2 hover:border-primary"
            onClick={() => navigate("/login/admin")}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                Sou Bombeiro/Admin
              </h2>
              <p className="text-muted-foreground">
                Acesse o painel administrativo para gerenciar vistorias e processos
              </p>
              <Button 
                size="lg" 
                className="w-full bg-gradient-primary hover:shadow-lg transition-all"
              >
                Acessar Painel Admin
              </Button>
            </div>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-white/80 text-sm">
          <p>Sistema oficial do Corpo de Bombeiros Militar de Pernambuco</p>
          <p className="mt-2">© 2025 CBM-PE - Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
