import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, FileText, Download, Image as ImageIcon, File as FileIcon, FileSpreadsheet, Eye, Trash2, Paperclip, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import {
  DialogFooter,
} from "@/components/ui/dialog";

interface Process {
  id: string;
  process_number: string;
  company_name: string;
  cnpj: string;
  address: string;
  current_status: string;
  created_at: string;
  updated_at: string;
  // Campos de contato podem não existir em bancos remotos não migrados
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

interface ProcessHistory {
  id: string;
  status: string;
  step_status: string;
  observations: string;
  responsible_name: string;
  created_at: string;
}

  interface ProcessDocument {
    id: string;
    document_name: string;
    document_type: string;
    file_url: string;
    status: string;
    rejection_reason: string;
    correction_justification?: string;
    resubmitted_at?: string;
    stage?: string;
    uploaded_at: string;
    disponivel_usuario?: boolean;
    carimbado_por?: string | null;
    data_carimbo?: string | null;
  }

interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_url: string;
  status: string;
  rejection_reason?: string;
  correction_justification?: string;
  uploaded_at: string;
}

const DetalheProcesso = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [process, setProcess] = useState<Process | null>(null);
  const [history, setHistory] = useState<ProcessHistory[]>([]);
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Dropzone state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewDoc, setPreviewDoc] = useState<{ type: "image" | "pdf" | "other"; url: string; name: string } | null>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitDoc, setResubmitDoc] = useState<ProcessDocument | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitJustification, setResubmitJustification] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [versionsByDoc, setVersionsByDoc] = useState<Record<string, DocumentVersion[]>>({});
  const [hasVersionsTable, setHasVersionsTable] = useState<boolean>(true);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  // Fallback: extrai contato do histórico se colunas não existirem
  const getContactInfo = () => {
    const name = (process as any)?.contact_name as string | undefined;
    const phone = (process as any)?.contact_phone as string | undefined;
    const email = (process as any)?.contact_email as string | undefined;
    if (name && phone && email) {
      return { name, phone, email };
    }
    const creationEntry = history.find(
      (h) => (h.status || "") === "cadastro" && (h.observations || "").includes("Contato:")
    );
    if (creationEntry) {
      const after = (creationEntry.observations || "").split("Contato:")[1]?.trim() || "";
      const [n, p, e] = after.split("|").map((s) => s.trim());
      return { name: name || n || "", phone: phone || p || "", email: email || e || "" };
    }
    return { name: name || "", phone: phone || "", email: email || "" };
  };

  useEffect(() => {
    checkAuth();
    if (id) {
      fetchProcess();
      fetchHistory();
      fetchDocuments();
    }
  }, [id]);

  // Refresh automático quando vem de link externo (WhatsApp)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromNotification = urlParams.get('from') === 'notification';
    
    if (fromNotification && id) {
      // Força refresh dos dados quando vem de notificação
      setTimeout(() => {
        fetchProcess();
        fetchHistory();
        fetchDocuments();
      }, 1000);
    }
  }, [id]);

  // Assinaturas Realtime para sincronização instantânea da timeline e documentos
  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`process-sync-user-${id}`);

    // Atualizações no processo (etapa atual, timestamps)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'processes',
      filter: `id=eq.${id}`,
    }, () => {
      fetchProcess();
    });

    // Histórico: novas ações ou alterações
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'process_history',
      filter: `process_id=eq.${id}`,
    }, () => {
      fetchHistory();
    });

    // Documentos: envios, correções, aprovações, rejeições
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'process_documents',
      filter: `process_id=eq.${id}`,
    }, () => {
      fetchDocuments();
    });

    channel.subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [id]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login/usuario");
    }
  };

  const fetchProcess = async () => {
    console.log("🔍 Buscando processo ID:", id);
    try {
      const data = await dynamodb.processes.getById(id!);
      console.log("✅ Processo encontrado:", data);
      setProcess(data);
    } catch (error: any) {
      console.error("❌ Erro ao buscar processo:", error);
      toast({
        title: "Erro ao carregar processo",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard/usuario");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    console.log("📜 Buscando histórico do processo:", id);
    try {
      const data = await dynamodb.history.getByProcessId(id!);
      console.log("✅ Histórico encontrado:", data?.length || 0, "entradas");
      setHistory(data || []);
    } catch (error: any) {
      console.error("❌ Erro ao buscar histórico:", error);
    }
  };

  const fetchDocuments = async () => {
    console.log("📄 Buscando documentos do processo:", id);
    try {
      const data = await dynamodb.documents.getByProcessId(id!);
      console.log("✅ Documentos encontrados:", data?.length || 0, "documentos");
      setDocuments(data || []);
      if (data && data.length > 0) {
        await fetchVersions(data.map(d => d.id));
      } else {
        setVersionsByDoc({});
      }
      if (data && data.some(d => d.status === "rejected")) {
        toast({
          title: "Documento reprovado",
          description: "Há documentos reprovados. Corrija e reenvie com justificativa.",
        });
      }
    } catch (error: any) {
      console.error("❌ Erro ao buscar documentos:", error);
    }
  };

  const fetchVersions = async (docIds: string[]) => {
    try {
      if (!hasVersionsTable) return;
      const { data, error } = await supabase
        .from("process_document_versions")
        .select("*")
        .in("document_id", docIds)
        .order("version_number", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, DocumentVersion[]> = {};
      (data || []).forEach(v => {
        if (!grouped[v.document_id]) grouped[v.document_id] = [];
        grouped[v.document_id].push(v as any);
      });
      setVersionsByDoc(grouped);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Not Found") || msg.includes("404") || msg.includes("does not exist")) {
        setHasVersionsTable(false);
        setVersionsByDoc({});
        console.warn("Tabela process_document_versions ausente; recursos de versão desativados (usuário). ");
        return;
      }
      console.error("Erro ao carregar versões:", err);
    }
  };

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.ms-excel",
  ];

  const onDrop = (acceptedFiles: File[]) => {
    const valid = acceptedFiles.filter(f => allowedTypes.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length !== acceptedFiles.length) {
      toast({
        title: "Alguns arquivos foram ignorados",
        description: "Apenas PDF, JPG, PNG, DOCX e XLSX até 10MB",
        variant: "destructive",
      });
    }
    const next = [...pendingFiles, ...valid];
    setPendingFiles(next);
    // Generate local previews for images
    const previews: Record<string, string> = {};
    next.forEach(f => {
      if (f.type.startsWith("image/")) {
        previews[f.name] = URL.createObjectURL(f);
      }
    });
    setPreviewUrls(prev => ({ ...prev, ...previews }));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const clearPendingFile = (name: string) => {
    setPendingFiles(files => files.filter(f => f.name !== name));
    const url = previewUrls[name];
    if (url) URL.revokeObjectURL(url);
    setPreviewUrls(prev => {
      const cpy = { ...prev };
      delete cpy[name];
      return cpy;
    });
  };

  const handleBatchUpload = async () => {
    if (!id || pendingFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      let uploaded = 0;
      for (const f of pendingFiles) {
        const ext = f.name.split(".").pop();
        const ts = Date.now();
        const path = `${id}/${ts}_${Math.random().toString(36).slice(2)}.${ext}`;
        // Upload usando nosso sistema S3
        const { storage } = await import("@/lib/storage");
        const fileUrl = await storage.upload(f, `process-documents/${id}`);
        const docType =
          f.type.startsWith("image/") ? "imagem" :
          f.type === "application/pdf" ? "pdf" :
          f.type.includes("word") ? "docx" :
          f.type.includes("sheet") ? "xlsx" : "arquivo";
        const payloadBase = {
          process_id: id,
          document_name: f.name,
          document_type: docType,
          file_url: fileUrl,
          status: "pending",
        } as any;
        const payloadWithStage = {
          ...payloadBase,
          stage: process?.current_status || "cadastro",
        };
        // Salvar no DynamoDB
        await dynamodb.documents.create(payloadWithStage);
        uploaded += 1;
        setUploadProgress(Math.round((uploaded / pendingFiles.length) * 100));
      }
      toast({ title: "Arquivos enviados!", description: "Os anexos foram enviados para análise." });
      // Reset
      setPendingFiles([]);
      Object.values(previewUrls).forEach(u => URL.revokeObjectURL(u));
      setPreviewUrls({});
      setUploadOpen(false);
      fetchDocuments();
    } catch (error: any) {
      toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Exclusão de documentos removida conforme regras do fluxo.

  const handleDownload = async (doc: ProcessDocument) => {
    console.log("📥 Download documento:", doc.document_name, "URL:", doc.file_url);
    try {
      // Se já é uma URL completa do S3, usar diretamente
      if (doc.file_url.startsWith("https://")) {
        console.log("🔗 Abrindo URL S3 diretamente:", doc.file_url);
        window.open(doc.file_url, '_blank');
        return;
      }

      // Se não é URL completa, tentar gerar URL assinada
      const { storage } = await import("@/lib/storage");
      const signedUrl = await storage.getSignedUrl(doc.file_url);
      console.log("🔗 URL assinada gerada:", signedUrl);
      window.open(signedUrl, '_blank');
    } catch (error: any) {
      console.error("❌ Erro no download:", error);
      toast({
        title: 'Erro ao baixar documento',
        description: error?.message || 'Não foi possível obter o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const openPreviewForDoc = async (doc: ProcessDocument) => {
    console.log("👁️ Preview documento:", doc.document_name, "URL:", doc.file_url);
    try {
      let previewUrl = doc.file_url;

      // Se já é uma URL completa do S3, usar diretamente
      if (doc.file_url.startsWith("https://")) {
        console.log("🔗 Usando URL S3 diretamente para preview:", previewUrl);
      } else {
        // Se não é URL completa, construir URL do S3
        const S3_BUCKET = import.meta.env.VITE_S3_BUCKET || 'cbmpe-documents';
        const S3_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';
        
        // Verificar se já tem o prefixo process-documents
        const key = doc.file_url.startsWith('process-documents/') 
          ? doc.file_url 
          : `process-documents/${doc.file_url}`;
          
        previewUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
        console.log("🔗 URL S3 construída para preview:", previewUrl);
      }

      const type = doc.document_type === "pdf" || doc.file_url.endsWith(".pdf") ? "pdf" : (doc.document_type === "imagem" || doc.file_url.match(/\.(png|jpg|jpeg)$/i)) ? "image" : "other";
      setPreviewDoc({ type, url: previewUrl, name: doc.document_name });
    } catch (e: any) {
      console.error("❌ Erro no preview:", e);
      toast({ title: "Erro ao abrir pré-visualização", description: e?.message || "Tente o download.", variant: "destructive" });
    }
  };

  const addToHistory = async (observations: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !process) return;
      await dynamodb.history.create({ 
        process_id: id!, 
        status: process.current_status, 
        step_status: "resubmitted", 
        observations, 
        responsible_id: user.id, 
        responsible_name: "Usuário" 
      });
    } catch (err) {
      console.error("Falha ao registrar histórico de reenvio", err);
    }
  };

  const handleDeleteDocument = async (doc: ProcessDocument) => {
    console.log("🗑️ Deletando documento:", doc.document_name);
    
    if (!confirm(`Tem certeza que deseja apagar o documento "${doc.document_name}"?`)) {
      return;
    }

    try {
      // Deletar do DynamoDB
      await dynamodb.documents.delete(doc.id);
      
      // Adicionar ao histórico
      await addToHistory(`Documento removido: ${doc.document_name}`);
      
      // Atualizar lista de documentos
      await fetchDocuments();
      
      toast({
        title: "Documento removido",
        description: `${doc.document_name} foi removido com sucesso.`,
      });
    } catch (error: any) {
      console.error("❌ Erro ao deletar documento:", error);
      toast({
        title: "Erro ao remover documento",
        description: error.message || "Não foi possível remover o documento.",
        variant: "destructive",
      });
    }
  };

  const handleResubmitDocument = async () => {
    if (!resubmitDoc || !resubmitFile || !id) return;
    if (!resubmitJustification.trim()) {
      toast({ title: "Informe a justificativa", description: "Descreva o que foi corrigido.", variant: "destructive" });
      return;
    }
    setResubmitting(true);
    try {
      const allowed = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "application/vnd.ms-excel",
      ];
      if (!allowed.includes(resubmitFile.type)) {
        throw new Error("Tipo de arquivo não permitido");
      }
      if (resubmitFile.size > 10 * 1024 * 1024) {
        throw new Error("Arquivo acima de 10MB");
      }

      // Upload usando nosso sistema S3
      const { storage } = await import("@/lib/storage");
      const fileUrl = await storage.upload(resubmitFile, `process-documents/${id}`);

      // Atualizar documento no DynamoDB
      await dynamodb.documents.update(resubmitDoc.id, {
        file_url: fileUrl,
        status: "resubmitted",
        correction_justification: resubmitJustification.trim(),
        resubmitted_at: new Date().toISOString(),
      });

      await addToHistory(`Reenvio de documento: ${resubmitDoc.document_name}. Justificativa: ${resubmitJustification.trim()}`);

      // Notificar admin sobre correção via WhatsApp (opcional)
      try {
        const evolutionApiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
        const evolutionApiToken = import.meta.env.VITE_EVOLUTION_API_TOKEN;
        const evolutionInstance = import.meta.env.VITE_EVOLUTION_INSTANCE;

        if (evolutionApiUrl && evolutionApiToken && evolutionInstance) {
          const adminMessage = `📄 *DOCUMENTO CORRIGIDO* - CBM-PE

🏢 *Empresa:* ${process?.company_name}
📋 *Processo:* ${process?.process_number}
📎 *Documento:* ${resubmitDoc.document_name}

💬 *Justificativa:* ${resubmitJustification.trim()}

🔗 *Analisar:* ${window.location.origin}/admin/processo/${id}

⏰ *Aguardando nova análise do bombeiro*`;

          // Enviar para número do admin (configurável)
          const adminPhone = "5581999999999"; // Configurar número do admin
          
          await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiToken,
            },
            body: JSON.stringify({
              number: adminPhone,
              text: adminMessage,
            }),
          });
        }
      } catch (error) {
        console.log("Notificação admin opcional falhou:", error);
      }

      toast({ title: "Documento reenviado", description: "Aguardando nova análise do Bombeiro." });
      setResubmitOpen(false);
      setResubmitDoc(null);
      setResubmitFile(null);
      setResubmitJustification("");
      fetchDocuments();
    } catch (e: any) {
      const message = e?.message || e?.error?.message || "Tente novamente mais tarde";
      const details = e?.details || e?.error?.details;
      const hint = e?.hint || e?.error?.hint;
      const composed = [message, details, hint].filter(Boolean).join(" — ");
      toast({ title: "Falha ao reenviar", description: composed, variant: "destructive" });
    } finally {
      setResubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!process) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/usuario")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <img
              src="https://d1yjjnpx0p53s8.cloudfront.net/styles/logo-thumbnail/s3/0014/4626/brand.gif?itok=gRLiGl3R"
              alt="Corpo de Bombeiro Militar de Pernambuco"
              className="w-24 h-24 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">Processo {process.process_number}</h1>
              <p className="text-sm text-muted-foreground">{process.company_name}</p>
            </div>
          </div>
          <StatusBadge status={process.current_status as any} />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Timeline Top Card */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📋 Timeline do Processo</h2>
          <ProcessTimeline 
            currentStatus={process.current_status as any}
            history={history}
            attachments={documents}
            mode="user"
            onPreviewDoc={openPreviewForDoc as any}
            onDownloadDoc={handleDownload as any}
          />
          <h3 className="text-base font-semibold mb-2 text-muted-foreground">
            Etapa Atual: {(() => {
              const map: Record<string, string> = {
                cadastro: "Cadastro",
                triagem: "Triagem",
                vistoria: "Vistoria",
                comissao: "Comissão",
                aprovacao: "Aprovação Final",
                concluido: "Concluído",
                exigencia: "Em Exigência",
              };
              return map[process.current_status] || process.current_status;
            })()}
          </h3>
        </Card>

        {/* Two-column grid: Informações + Documentos da Etapa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações do Processo (compacto com Ver mais) */}
          <Card className="p-4 bg-muted/30 border border-muted-foreground/20 shadow-sm flex flex-col justify-between">
            <h4 className="font-semibold text-foreground mb-3">📍 Informações do Processo</h4>
            <div>
              <p className="text-sm"><strong>Número:</strong> {process.process_number}</p>
              <p className="text-sm"><strong>Empresa:</strong> {process.company_name}</p>
              <p className="text-sm flex items-center gap-2"><strong>Status:</strong> <StatusBadge status={process.current_status as any} type="process" /></p>
              <p className="text-sm"><strong>Última atualização:</strong> {new Date(process.updated_at).toLocaleDateString("pt-BR")}</p>
              <Button variant="link" className="mt-2 p-0 h-auto text-sm" onClick={() => setMostrarDetalhes(!mostrarDetalhes)}>
                {mostrarDetalhes ? "Ocultar detalhes" : "Ver detalhes completos"}
              </Button>
              {mostrarDetalhes && (
                <div className="mt-3 text-sm text-muted-foreground space-y-1">
                  <p><strong>CNPJ:</strong> {process.cnpj}</p>
                  <p><strong>Endereço:</strong> {process.address}</p>
                  {(() => { const c = getContactInfo(); return (
                    <>
                      <p><strong>Contato:</strong> {c.name || "—"}</p>
                      <p><strong>Telefone:</strong> {c.phone || "—"}</p>
                      <p><strong>E-mail:</strong> {c.email || "—"}</p>
                    </>
                  ); })()}
                  <p><strong>Data de Abertura:</strong> {new Date(process.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Documentos da Etapa (filtrados pela etapa atual) */}
          <Card className="p-4 bg-muted/30 border border-muted-foreground/20 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-foreground">📄 Documentos da Etapa</h4>
              {(["cadastro","triagem","vistoria","exigencia"] as string[]).includes(process.current_status) ? (
                <Dialog open={uploadOpen} onOpenChange={(open) => {
                  if (!open) {
                    Object.values(previewUrls).forEach(u => URL.revokeObjectURL(u));
                    setPreviewUrls({});
                    setPendingFiles([]);
                  }
                  setUploadOpen(open);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enviar Documento</DialogTitle>
                      <DialogDescription>
                        Arraste e solte arquivos (PDF, JPG, PNG, DOCX, XLSX) — máx. 10MB cada
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${isDragActive ? "bg-primary/5 border-primary" : "bg-muted/50"}`}
                      >
                        <input {...getInputProps()} />
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Paperclip className="w-5 h-5" />
                          <span>Solte os arquivos aqui ou clique para selecionar</span>
                        </div>
                      </div>
                      {pendingFiles.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">Pré-visualização</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {pendingFiles.map((f) => {
                              const isImg = f.type.startsWith("image/");
                              const isPdf = f.type === "application/pdf";
                              const url = previewUrls[f.name];
                              return (
                                <div key={f.name} className="border rounded-lg p-2 bg-card">
                                  <div className="aspect-video rounded mb-2 flex items-center justify-center overflow-hidden bg-muted">
                                    {isImg && url ? (
                                      <img src={url} alt={f.name} className="object-cover w-full h-full" />
                                    ) : (
                                      <div className="text-muted-foreground flex flex-col items-center">
                                        {isPdf ? <FileText className="w-8 h-8" /> : <FileIcon className="w-8 h-8" />}
                                        <span className="text-xs mt-1 truncate max-w-[120px]">{f.name}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Button variant="outline" size="sm" onClick={() => setPreviewDoc({ type: isPdf ? "pdf" : (isImg ? "image" : "other"), url: url || "", name: f.name })}>
                                      <Eye className="w-4 h-4 mr-1" />
                                      Ver
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => clearPendingFile(f.name)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <div className="w-full space-y-2">
                          {uploading && <Progress value={uploadProgress} />}
                          <Button className="w-full" onClick={handleBatchUpload} disabled={uploading || pendingFiles.length === 0}>
                            {uploading ? "Enviando..." : `Enviar ${pendingFiles.length} arquivo(s)`}
                          </Button>
                        </div>
                      </DialogFooter>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button size="sm" disabled>
                          <Upload className="w-4 h-4 mr-2" />
                          Enviar
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">Envio bloqueado nesta etapa. Aguarde liberação.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {(() => {
              const documentosEtapa = documents.filter(d => (d.stage || "") === process.current_status);
              if (documentosEtapa.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">Nenhum documento enviado nesta etapa.</p>
                );
              }
              return (
                <ul className="divide-y divide-muted-foreground/20">
                  {documentosEtapa.map((doc) => (
                    <li key={doc.id} className="flex justify-between items-center py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="text-primary w-5 h-5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {doc.status === 'completed' ? '✅ Aprovado' : doc.status === 'pending' ? '⏳ Em análise' : doc.status === 'rejected' ? '❌ Reprovado' : doc.status === 'resubmitted' ? '🔁 Corrigido/Reenviado' : doc.status}
                          </p>
                          {doc.rejection_reason && (
                            <p className="text-[11px] text-red-600 mt-1">{doc.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => openPreviewForDoc(doc)}>
                          👁️ Ver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                          ⬇️ Baixar
                        </Button>
                        {doc.status === 'rejected' && (
                          <Button size="sm" variant="destructive" onClick={() => { setResubmitDoc(doc); setResubmitOpen(true); }}>
                            🔁 Corrigir/Reenviar
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </Card>
        </div>

        {/* Documento Final Aprovado e Liberado */}
        {documents.some((d) => d.document_type === "certificado_final" && d.status === "completed" && !!d.disponivel_usuario) && (
          <Card className="p-6 mt-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
            <h2 className="text-lg font-bold mb-2">Documento Aprovado e Carimbado pelo CBM-PE</h2>
            {(() => {
              const finalDoc = documents.find((d) => d.document_type === "certificado_final" && d.status === "completed" && !!d.disponivel_usuario);
              if (!finalDoc) return null;
              const liberadoEm = finalDoc.data_carimbo ? new Date(finalDoc.data_carimbo).toLocaleString("pt-BR") : null;
              return (
                <>
                  <p className="text-sm text-muted-foreground mb-2">O certificado final está liberado para download.</p>
                  {liberadoEm && (
                    <p className="text-xs text-muted-foreground">Liberado em: {liberadoEm}</p>
                  )}
                  {finalDoc.carimbado_por && (
                    <p className="text-xs text-muted-foreground mb-4">Responsável: {finalDoc.carimbado_por}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openPreviewForDoc(finalDoc)}>Visualizar Documento Final</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(finalDoc)}>Baixar Certificado PDF</Button>
                  </div>
                </>
              );
            })()}
          </Card>
        )}

        {/* Preview Modal */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Pré-visualização: {previewDoc?.name}</DialogTitle>
                  <DialogDescription>Confirme o conteúdo antes de baixar ou enviar.</DialogDescription>
                </DialogHeader>
                {previewDoc?.type === "image" && previewDoc.url && (
                  <img src={previewDoc.url} alt={previewDoc.name} className="w-full h-auto rounded" />
                )}
                {previewDoc?.type === "pdf" && previewDoc.url && (
                  <iframe src={previewDoc.url} title={previewDoc.name} className="w-full h-[70vh] rounded" />
                )}
                {previewDoc?.type === "other" && (
                  <div className="p-4 bg-muted rounded text-sm">
                    Pré-visualização indisponível para este tipo de arquivo. Utilize o botão de download.
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Resubmit Dialog */}
            <Dialog open={resubmitOpen} onOpenChange={(open) => {
              if (!open) {
                setResubmitOpen(false);
                setResubmitDoc(null);
                setResubmitFile(null);
                setResubmitJustification("");
              } else {
                setResubmitOpen(true);
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Corrigir e reenviar documento</DialogTitle>
                  <DialogDescription>
                    Selecione o novo arquivo e informe a justificativa da correção.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-file">Novo arquivo</Label>
                    <Input id="new-file" type="file" onChange={(e) => setResubmitFile(e.target.files?.[0] || null)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="justification">Justificativa da correção *</Label>
                    <textarea id="justification" className="w-full border rounded p-2" rows={4} value={resubmitJustification} onChange={(e) => setResubmitJustification(e.target.value)} placeholder="Explique o que foi corrigido e por quê" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResubmitOpen(false)}>Cancelar</Button>
                  <Button onClick={handleResubmitDocument} disabled={resubmitting || !resubmitFile || !resubmitJustification.trim()}>
                    {resubmitting ? "Reenviando..." : "Enviar correção"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
      </main>
    </div>
  );
};

export default DetalheProcesso;
