import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, FileText, Download, Image as ImageIcon, File as FileIcon, FileSpreadsheet, Eye, Trash2, Paperclip, ShieldCheck, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
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

import { QRCodeSVG } from "qrcode.react";

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
  // Pagamento / Boleto
  taxa_bombeiro_valor?: number;
  taxa_bombeiro_pago?: boolean;
  boleto_url?: string;
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
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [boletoModalOpen, setBoletoModalOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [docsSubmitOpen, setDocsSubmitOpen] = useState(false);
  const requiredDocsEntrada = [
    { id: "identidade", nome: "Carteira de Identidade do Proprietário ou Representante Legal", obrigatorio: true, pattern: /identidad|rg|carteira/ },
    { id: "procuracao", nome: "Procuração com Firma Reconhecida (se aplicável)", obrigatorio: false, pattern: /procuracao|procura/ },
    { id: "cnpjcpf", nome: "Comprovante de Inscrição CNPJ/CPF", obrigatorio: true, pattern: /cnpj|cpf|inscricao/ },
    { id: "memorial", nome: "Memorial Descritivo da Edificação", obrigatorio: true, pattern: /memorial/ },
    { id: "ppci", nome: "Projeto de Prevenção e Combate a Incêndio (PPCI)", obrigatorio: true, pattern: /ppci|projeto/ },
  ];
  const findUploadedByPattern = (pattern: RegExp) => {
    const lower = (s: string) => (s || "").toLowerCase();
    return documents.find(d => lower(d.document_name).match(pattern) && ((d.stage || "cadastro") === "cadastro"));
  };
  const fileInputsByDocId = useRef<Record<string, HTMLInputElement | null>>({});

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

  const generateProcessNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `${year}${random}`;
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

  const uploadDocFor = async (item: { id: string; nome: string }, file: File) => {
     if (!id) return;
     try {
       const type = file.type;
       if (!allowedTypes.includes(type) || file.size > 10 * 1024 * 1024) {
         toast({ title: "Arquivo inválido", description: "Use PDF, JPG, PNG, DOCX ou XLSX até 10MB.", variant: "destructive" });
         return;
       }
       const { storage } = await import("@/lib/storage");
       const fileUrl = await storage.upload(file, `process-documents/${id}`);
       const docType =
         type.startsWith("image/") ? "imagem" :
         type === "application/pdf" ? "pdf" :
         type.includes("word") ? "docx" :
         type.includes("sheet") ? "xlsx" : "arquivo";
 
       await dynamodb.documents.create({
         process_id: id,
         document_name: item.nome,
         document_type: docType,
         file_url: fileUrl,
         status: "pending",
         stage: "cadastro",
       } as any);
 
       await fetchDocuments();
       toast({ title: "Documento anexado", description: `${item.nome} foi anexado.` });
     } catch (e: any) {
       toast({ title: "Falha ao anexar", description: e?.message || "Tente novamente.", variant: "destructive" });
     }
   };
 
   const replaceUploadedDoc = async (existing: ProcessDocument, file: File) => {
     if (!id) return;
     try {
       const type = file.type;
       if (!allowedTypes.includes(type) || file.size > 10 * 1024 * 1024) {
         toast({ title: "Arquivo inválido", description: "Use PDF, JPG, PNG, DOCX ou XLSX até 10MB.", variant: "destructive" });
         return;
       }
       const { storage } = await import("@/lib/storage");
       const fileUrl = await storage.upload(file, `process-documents/${id}`);
       const docType =
         type.startsWith("image/") ? "imagem" :
         type === "application/pdf" ? "pdf" :
         type.includes("word") ? "docx" :
         type.includes("sheet") ? "xlsx" : "arquivo";
 
       await dynamodb.documents.update(existing.id, {
         file_url: fileUrl,
         document_type: docType,
         status: "pending",
         resubmitted_at: new Date().toISOString(),
       });
 
       await fetchDocuments();
       toast({ title: "Documento atualizado", description: `${existing.document_name} foi substituído.` });
     } catch (e: any) {
       toast({ title: "Falha ao atualizar", description: e?.message || "Tente novamente.", variant: "destructive" });
     }
   };

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
        status: "pending",
        correction_justification: resubmitJustification.trim(),
        resubmitted_at: new Date().toISOString(),
        rejection_reason: null,
      });

      // Atualizar estado local imediatamente para evitar inconsistências
      setDocuments(prev => prev.map(doc => 
        doc.id === resubmitDoc.id 
          ? { 
              ...doc, 
              file_url: fileUrl, 
              status: "pending", 
              rejection_reason: null,
              correction_justification: resubmitJustification.trim(),
              resubmitted_at: new Date().toISOString(),
            } 
          : doc
      ));

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
                cadastro: "Entrada",
                triagem: "Triagem",
                vistoria: "Vistoria",
                comissao: "Alocação de Viabilidade",
                aprovacao: "Emissão AVCB",
                concluido: "Emissão AVCB",
                exigencia: "Em Exigência",
              };
              return map[process.current_status] || process.current_status;
            })()}
          </h3>
        </Card>

        {/* Página da Etapa “Entrada” */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Detalhamento da Solicitação do Atestado de Vistoria</h2>
          {/* Bloco superior (resumo da solicitação) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground">Abertura</p>
              <p className="font-medium">{new Date(process.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
              <p className="font-medium">{process.cnpj}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Protocolo</p>
              <p className="font-medium">
                {(() => {
                  const pago = (process as any)?.taxa_bombeiro_pago || process.current_status !== "aguardando_pagamento";
                  return pago ? (process.process_number || "—") : <span className="text-red-600">Protocolo gerado após pagamento</span>;
                })()}
              </p>
            </div>
            <div className="lg:col-span-1 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Razão Social / Nome</p>
              <p className="font-medium truncate">{process.company_name}</p>
            </div>
          </div>

          {/* Seção: Histórico de Requerimento */}
          <div className="space-y-4">
            {/* 1️⃣ Confirmação de Pagamento */}
            {(() => {
              const aguardando = process.current_status === "aguardando_pagamento" || !(process as any)?.taxa_bombeiro_pago;
              return (
                <div className={`rounded-lg p-4 border ${aguardando ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800" : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"}`}>
                  <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                    {aguardando ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirmação de Pagamento
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {aguardando
                      ? "Aguardando o pagamento da DAM 20. Após a compensação bancária, o protocolo será emitido e o processo seguirá para triagem."
                      : "Pagamento confirmado. Protocolo emitido e processo avançado para triagem."}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    {aguardando ? (
                      <>
                        <span className="text-yellow-700 dark:text-yellow-400 font-medium">Aguardando Pagamento</span>
                        <Button variant="outline" size="sm" onClick={() => setBoletoModalOpen(true)}>
                          Emitir 2ª Via
                        </Button>
                      </>
                    ) : (
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        Pagamento Confirmado {new Date(process.updated_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 2️⃣ Solicitação */}
            <div className="border rounded-lg p-4">
              <h3 className="text-base font-semibold mb-3">Solicitação</h3>
              <div className="flex gap-2 mb-3">
                <Button size="sm" variant="outline" onClick={() => setInfoModalOpen(true)}>
                  <Eye className="w-4 h-4 mr-2" /> Visualizar Informações
                </Button>
                <Button size="sm" variant="destructive" onClick={async () => {
                  const ok1 = window.confirm("Tem certeza que deseja excluir esta solicitação?");
                  if (!ok1) return;
                  const ok2 = window.confirm("Confirme novamente: esta ação é irreversível.");
                  if (!ok2 || !id) return;
                  try {
                    await dynamodb.processes.delete(id);
                    toast({ title: "Solicitação excluída", description: "O formulário foi removido com sucesso." });
                    navigate("/dashboard/usuario");
                  } catch (e: any) {
                    toast({ title: "Erro ao excluir", description: e.message || "Tente novamente.", variant: "destructive" });
                  }
                }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Formulário
                </Button>
              </div>
              {/* Histórico cronológico de versões da solicitação */}
              <div className="space-y-1 text-sm text-muted-foreground">
                {history.filter(h => (h.status || "") === "cadastro").map((h) => (
                  <p key={h.id}>📄 Solicitação - {new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                ))}
                {history.filter(h => (h.status || "") === "cadastro").length === 0 && (
                  <p>— Sem versões anteriores —</p>
                )}
              </div>
            </div>
          </div>

          {/* 3️⃣ Documentação a ser Anexada */}
          {((process.current_status === "cadastro") && (process as any)?.taxa_bombeiro_pago) && (
            <div className="mt-6">
              <h3 className="text-xl font-bold text-red-700 mb-2">Documentação a ser Anexada</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requiredDocsEntrada.map((item) => {
                  const existing = findUploadedByPattern(item.pattern);
                  const isUploaded = !!existing;
                  const isRejected = existing?.status === "rejected";
                  return (
                    <div key={item.id} className="border rounded-lg p-4 shadow-sm border-red-300 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.nome}</p>
                          <p className={`text-xs ${item.obrigatorio ? "text-green-600" : "text-muted-foreground"}`}>{item.obrigatorio ? "Obrigatório" : "Opcional"}</p>
                        </div>
                        <div className="text-sm">
                          {isRejected ? (
                            <span className="text-red-600">Reprovado</span>
                          ) : isUploaded ? (
                            <span className="text-green-700">Anexado</span>
                          ) : (
                            <span className="text-yellow-700">Pendente</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        {!isUploaded ? (
                          <label className="inline-flex items-center">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.png,.jpeg,.docx,.xlsx"
                              className="hidden"
                              ref={(el) => { fileInputsByDocId.current[item.id] = el; }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                if (!isUploaded) uploadDocFor(item as any, f);
                                else if (existing) replaceUploadedDoc(existing, f);
                              }}
                            />
                            <Button size="sm" className="bg-red-700 hover:bg-red-800 text-white" onClick={() => fileInputsByDocId.current[item.id]?.click()}>
                              <Paperclip className="w-4 h-4 mr-2" /> Anexar
                            </Button>
                          </label>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => existing && openPreviewForDoc(existing)}>Pré-visualizar</Button>
                            <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => fileInputsByDocId.current[item.id]?.click()}>Editar</Button>
                            <Button size="sm" variant="outline" onClick={() => existing && handleDeleteDocument(existing)}>Excluir</Button>
                          </div>
                        )}
                      </div>

                      {isRejected && existing?.rejection_reason && (
                        <p className="text-xs text-red-600 mt-2">Motivo: {existing.rejection_reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botão Enviar Documentação */}
              {(() => {
                const allRequiredUploaded = requiredDocsEntrada.filter(d => d.obrigatorio).every(d => !!findUploadedByPattern(d.pattern));
                return (
                  <div className="mt-4">
                    <Button
                      className="bg-green-700 hover:bg-green-800 text-white font-semibold"
                      disabled={!allRequiredUploaded}
                      onClick={() => setDocsSubmitOpen(true)}
                    >
                      Enviar Documentação
                    </Button>
                    {!allRequiredUploaded && (
                      <p className="text-xs text-muted-foreground mt-2">Anexe todos os documentos obrigatórios para habilitar o envio.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Modal de confirmação: Enviar Documentação */}
          <Dialog open={docsSubmitOpen} onOpenChange={setDocsSubmitOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Enviar documentos para triagem?</DialogTitle>
                <DialogDescription>Após o envio, os anexos ficam bloqueados até o retorno da análise.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDocsSubmitOpen(false)}>Cancelar</Button>
                <Button onClick={async () => {
                  if (!id) return;
                  try {
                    await dynamodb.processes.update(id, {
                      current_status: "triagem",
                    });
                    await dynamodb.history.create({
                      process_id: id,
                      status: "triagem",
                      step_status: "in_progress",
                      observations: "Documentação enviada para triagem.",
                      responsible_name: process?.company_name || "Usuário",
                    } as any);
                    await fetchProcess();
                    await fetchHistory();
                    setDocsSubmitOpen(false);
                    toast({ title: "Documentação enviada", description: "Processo avançou para Triagem." });
                  } catch (e: any) {
                    toast({ title: "Erro ao enviar", description: e?.message || "Tente novamente.", variant: "destructive" });
                  }
                }}>Confirmar envio</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal: Emitir 2ª Via de Boleto */}
          <Dialog open={boletoModalOpen} onOpenChange={setBoletoModalOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Segunda Via de Boleto – CBM/PE</DialogTitle>
                <DialogDescription>Pagamento simulado para testes do SGVP – CBM/PE.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-2xl text-red-700">{typeof (process as any)?.taxa_bombeiro_valor === 'number' ? (process as any)?.taxa_bombeiro_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</p>
                  <p className="text-sm text-muted-foreground">Valor do Boleto</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Solicitante</p>
                    <p className="font-medium">{process?.company_name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Protocolo</p>
                    <p className="font-medium">{(process as any)?.taxa_bombeiro_pago ? (process?.process_number || '—') : 'Gerado após pagamento'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">{(() => { const d = new Date(Date.now() + 7*24*60*60*1000); return d.toLocaleDateString('pt-BR'); })()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="border rounded p-2">
                    <QRCodeSVG value={`Pagamento_CBMBPE_${id || ''}_${(process as any)?.taxa_bombeiro_valor || 0}`} size={140} />
                  </div>
                  <div className="text-sm">
                    <p className="font-mono tracking-wider">23793.38128 60000.004536 02002.123458 8 89080000012590</p>
                    <p className="text-xs text-muted-foreground mt-2">⚠️ Este é um pagamento simulado para fins de teste do sistema SGVP – CBM/PE. Após a confirmação, o status será atualizado automaticamente para “Pagamento Efetuado”.</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBoletoModalOpen(false)} disabled={paying}>Cancelar</Button>
                <Button className="bg-red-700 hover:bg-red-800 text-white font-semibold" onClick={async () => {
                  if (!id) return;
                  setPaying(true);
                  setTimeout(async () => {
                    try {
                      await dynamodb.processes.update(id, {
                        taxa_bombeiro_pago: true,
                        current_status: "cadastro",
                        process_number: process?.process_number || generateProcessNumber(),
                      });
                      await dynamodb.history.create({
                        process_id: id,
                        status: "cadastro",
                        step_status: "awaiting_docs",
                        observations: "Pagamento confirmado (simulado). Aguardando envio da documentação.",
                        responsible_name: process?.company_name || "Usuário",
                      } as any);
                      await fetchProcess();
                      await fetchHistory();
                      setPaying(false);
                      toast({ title: "Pagamento confirmado", description: "Etapa Entrada habilitada para anexos.", variant: "default" });
                      setBoletoModalOpen(false);
                    } catch (e: any) {
                      setPaying(false);
                      toast({ title: "Falha ao atualizar", description: e?.message || "Tente novamente.", variant: "destructive" });
                    }
                  }, 1500);
                }} disabled={paying}>
                  {paying ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin"/>Processando...</>) : "Fazer Pagamento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal: Visualizar Informações completas */}
          <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Informações completas da solicitação</DialogTitle>
                <DialogDescription>Dados iniciais cadastrados.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><strong>Empresa:</strong> {process.company_name}</p>
                <p><strong>CNPJ:</strong> {process.cnpj}</p>
                <p><strong>Endereço:</strong> {process.address}</p>
                {(() => { const c = getContactInfo(); return (
                  <>
                    <p><strong>Contato:</strong> {c.name || "—"}</p>
                    <p><strong>Telefone:</strong> {c.phone || "—"}</p>
                    <p><strong>E-mail:</strong> {c.email || "—"}</p>
                  </>
                ); })()}
                {(process as any)?.taxa_bombeiro_valor && (
                  <p><strong>Taxa:</strong> R$ {Number((process as any)?.taxa_bombeiro_valor || 0).toFixed(2)}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </Card>

        {/* Grid: Informações do Processo */}
        <div className="grid grid-cols-1 gap-6">
          {/* Informações do Processo (compacto com Ver mais) */}
          <Card className="p-4 bg-muted/30 border border-muted-foreground/20 shadow-sm flex flex-col justify-between">
            <h4 className="font-semibold text-foreground mb-3">📍 Informações do Processo</h4>
            <div>
              <p className="text-sm"><strong>Número:</strong> {process.process_number}</p>
              <p className="text-sm"><strong>Empresa:</strong> {process.company_name}</p>
              <div className="text-sm flex items-center gap-2"><strong>Status:</strong> <StatusBadge status={process.current_status as any} type="process" /></div>
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
                  <p><strong>Data de Abertura:</strong> {new Date(process.created_at).toLocaleString("pt-BR")}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Documentos da Etapa removido conforme solicitação */}
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
