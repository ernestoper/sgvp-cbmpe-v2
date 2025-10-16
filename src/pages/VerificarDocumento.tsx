import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, QrCode, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  found: boolean;
  processNumber?: string;
  companyName?: string;
  cnpj?: string;
  approvedAt?: string;
  fileUrl?: string;
}

const VerificarDocumento = () => {
  const [params] = useSearchParams();
  const code = params.get("codigo") || "";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!code) return;
      setLoading(true);
      try {
        // Tenta localizar certificado final pelo padrão do path contendo o código
        const { data: docs, error } = await supabase
          .from("process_documents")
          .select("process_id, document_name, document_type, file_url, uploaded_at")
          .eq("document_type", "certificado_final")
          .like("file_url", `%/${code}.pdf`);

        if (error) throw error;

        if (!docs || docs.length === 0) {
          setResult({ found: false });
          return;
        }

        const doc = docs[0];
        const { data: proc } = await supabase
          .from("processes")
          .select("process_number, company_name, cnpj")
          .eq("id", doc.process_id)
          .maybeSingle();

        setResult({
          found: true,
          processNumber: proc?.process_number,
          companyName: proc?.company_name,
          cnpj: proc?.cnpj,
          approvedAt: doc.uploaded_at,
          fileUrl: doc.file_url,
        });
      } catch (err: any) {
        toast({
          title: "Erro na verificação",
          description: err?.message || "Não foi possível validar o código.",
          variant: "destructive",
        });
        setResult({ found: false });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [code]);

  const openCertificate = async () => {
    if (!result?.fileUrl) return;
    // Gera URL assinada para visualização
    const path = result.fileUrl.startsWith("http")
      ? (result.fileUrl.split("/process-documents/")[1] || result.fileUrl)
      : result.fileUrl;
    const { data: signed } = await supabase.storage
      .from("process-documents")
      .createSignedUrl(path, 60 * 10);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Verificação de Documento</h1>
            <p className="text-sm text-muted-foreground">Código: {code || "—"}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6">
          {loading ? (
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 animate-pulse" />
              <p>Validando código...</p>
            </div>
          ) : result?.found ? (
            <div className="space-y-4">
              <p className="text-green-700 dark:text-green-400 font-medium">✅ Documento válido e emitido pelo CBM-PE</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Processo</p>
                  <p className="font-medium">{result.processNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aprovado em</p>
                  <p className="font-medium">{result.approvedAt ? new Date(result.approvedAt).toLocaleString("pt-BR") : "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="font-medium">{result.companyName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{result.cnpj}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={openCertificate}>Visualizar Certificado</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Código não encontrado
              </p>
              <p className="text-sm text-muted-foreground">
                Verifique se o código foi digitado corretamente. Caso persista, entre em contato com o CBM-PE.
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default VerificarDocumento;