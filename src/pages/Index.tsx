import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, FileCheck, ShieldCheck, Building2, FilePlus2 } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const navigate = useNavigate();

  const onKeyNavigate = (e: React.KeyboardEvent<HTMLDivElement>, path: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero compacto sem imagens */}
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

      {/* Seção de Acesso acima do AVCB */}
      <section className="w-full max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-center text-foreground text-lg md:text-xl font-semibold mb-3">
          Escolha seu perfil de acesso
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="p-5 bg-white border cursor-pointer group hover:bg-[#F5F7FA] hover:border-[#1E5A8A] hover:shadow-lg transition-colors"
            onClick={() => navigate("/login/usuario")}
            role="button"
            tabIndex={0}
            aria-label="Acessar como Cidadão/Empresa"
            onKeyDown={(e) => onKeyNavigate(e, "/login/usuario")}
          >
            <div className="flex items-start gap-3">
              <motion.div
                className="w-12 h-12 rounded-full bg-[#0D3C61]/10 flex items-center justify-center"
                whileHover={{ scale: 1.08, rotate: 2 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <User className="w-6 h-6 text-[#0D3C61]" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-foreground">Sou Cidadão/Empresa</h3>
                <p className="text-muted-foreground text-sm">
                  Solicite vistorias, envie documentos e acompanhe seu processo em tempo real.
                </p>
                <Button size="md" className="mt-3 w-full bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] text-white hover:opacity-90 focus:ring-2 focus:ring-[#0D3C61]/40">
                  Acessar como Cidadão/Empresa
                </Button>
              </div>
            </div>
          </Card>
          <Card
            className="p-5 bg-white border cursor-pointer group hover:bg-[#F5F7FA] hover:border-[#1E5A8A] hover:shadow-lg transition-colors"
            onClick={() => navigate("/login/admin")}
            role="button"
            tabIndex={0}
            aria-label="Acessar como Bombeiro/Admin"
            onKeyDown={(e) => onKeyNavigate(e, "/login/admin")}
          >
            <div className="flex items-start gap-3">
              <motion.div
                className="w-12 h-12 rounded-full bg-[#0D3C61]/10 flex items-center justify-center"
                whileHover={{ scale: 1.08, rotate: -2 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <FileCheck className="w-6 h-6 text-[#0D3C61]" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-bold text-foreground">Sou Bombeiro/Admin</h3>
                <p className="text-muted-foreground text-sm">
                  Gerencie vistorias, documentos e emissões com painel administrativo completo.
                </p>
                <Button size="md" className="mt-3 w-full bg-gradient-to-r from-[#0D3C61] to-[#1E5A8A] text-white hover:opacity-90 focus:ring-2 focus:ring-[#0D3C61]/40">
                  Acessar como Bombeiro/Admin
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Seção Explicativa (AVCB) */}
      <section id="avcb" className="w-full max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-center text-foreground text-lg md:text-xl font-semibold mb-3">
          Por que emitir o AVCB?
        </h2>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="p-4 bg-white border hover:border-[#1E5A8A] hover:bg-[#F5F7FA] hover:shadow-lg transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#0D3C61]/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#0D3C61]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">O que é o AVCB</h3>
              <p className="text-muted-foreground text-sm">Certificado que atesta conformidade com normas de segurança contra incêndio.</p>
            </div>
          </Card>
          <Card className="p-4 bg-white border hover:border-[#1E5A8A] hover:bg-[#F5F7FA] hover:shadow-lg transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#0D3C61]/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-[#0D3C61]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Quem precisa emitir</h3>
              <p className="text-muted-foreground text-sm">Empresas, condomínios e edificações com exigência de segurança.</p>
            </div>
          </Card>
          <Card className="p-4 bg-white border hover:border-[#1E5A8A] hover:bg-[#F5F7FA] hover:shadow-lg transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#0D3C61]/10 flex items-center justify-center">
                <FilePlus2 className="w-6 h-6 text-[#0D3C61]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Como solicitar pelo SGVP</h3>
              <p className="text-muted-foreground text-sm">Cadastre, envie documentos e acompanhe vistorias de forma digital.</p>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Seção de Acesso (oculta, agora no Hero) */}
      <section className="hidden">
        {/* Mantida oculta para evitar duplicidade */}
      </section>

      {/* Rodapé Institucional */}
      <footer className="w-full bg-white border-t">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-xs md:text-sm text-muted-foreground flex items-center gap-2 justify-center">
          <div>
            <p>Sistema oficial do Corpo de Bombeiros Militar de Pernambuco</p>
            <p className="mt-1">© 2025 CBM-PE – Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
