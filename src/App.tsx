import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LoginUsuario from "./pages/LoginUsuario";
import LoginAdmin from "./pages/LoginAdmin";
import SetupAdmin from "./pages/SetupAdmin";
import DashboardUsuario from "./pages/DashboardUsuario";
import DashboardAdmin from "./pages/DashboardAdmin";
import NovoProcesso from "./pages/NovoProcesso";
import DetalheProcesso from "./pages/DetalheProcesso";
import DetalheProcessoAdmin from "./pages/DetalheProcessoAdmin";
import NotFound from "./pages/NotFound";
import VerificarDocumento from "./pages/VerificarDocumento";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login/usuario" element={<LoginUsuario />} />
          <Route path="/login/admin" element={<LoginAdmin />} />
          <Route path="/setup/admin" element={<SetupAdmin />} />
          <Route path="/dashboard/usuario" element={<DashboardUsuario />} />
          <Route path="/dashboard/admin" element={<DashboardAdmin />} />
          <Route path="/processo/novo" element={<NovoProcesso />} />
          <Route path="/processo/:id" element={<DetalheProcesso />} />
          <Route path="/admin/processo/:id" element={<DetalheProcessoAdmin />} />
          <Route path="/verificar" element={<VerificarDocumento />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
