import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft, Upload, FileText, Download, Image as ImageIcon, File as FileIcon, FileSpreadsheet, Eye, Trash2, Paperclip } from "lucide-react";
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
    try {
      const data = await dynamodb.processes.getById(id!);
      setProcess(data);
    } catch (error: any) {
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
    try {
      const data = await dynamodb.history.getByProcessId(id!);
      setHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching history:", error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const data = await dynamodb.documents.getByProcessId(id!);
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
      console.error("Error fetching documents:", error);
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
        const { error: uploadError } = await supabase.storage
          .from("process-documents")
          .upload(path, f, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const docType =
          f.type.startsWith("image/") ? "imagem" :
          f.type === "application/pdf" ? "pdf" :
          f.type.includes("word") ? "docx" :
          f.type.includes("sheet") ? "xlsx" : "arquivo";
        const payloadBase = {
          process_id: id,
          document_name: f.name,
          document_type: docType,
          file_url: path,
          status: "pending",
        } as any;
        const payloadWithStage = {
          ...payloadBase,
          stage: process?.current_status || "cadastro",
        };
        let { error: dbErr } = await supabase
          .from("process_documents")
          .insert(payloadWithStage);
        if (dbErr) {
          // Fallback: tenta sem a coluna stage, para compatibilidade com bancos sem a migration aplicada
          const { error: dbErr2 } = await supabase
            .from("process_documents")
            .insert(payloadBase);
          if (dbErr2) throw dbErr2;
        }
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
    try {
      // O campo file_url guarda o caminho do objeto. Se for um URL, extrai o path.
      const path = doc.file_url.startsWith("http")
        ? (doc.file_url.split("/process-documents/")[1] || doc.file_url)
        : doc.file_url;

      // Tenta gerar URL assinada (melhor UX)
      const { data: signed, error: signErr } = await supabase.storage
        .from('process-documents')
        .createSignedUrl(path, 60 * 10); // 10 min

      if (!signErr && signed?.signedUrl) {
        window.open(signed.signedUrl, '_blank');
        return;
      }

      // Fallback: baixar como Blob
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('process-documents')
        .download(path);

      if (dlErr || !fileData) throw dlErr || new Error('Falha ao baixar arquivo');

      const url = URL.createObjectURL(fileData);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name || 'documento';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: 'Erro ao baixar documento',
        description: error?.message || 'Não foi possível obter o arquivo.',
        variant: 'destructive',
      });
    }
  };

  const openPreviewForDoc = async (doc: ProcessDocument) => {
    try {
      const path = doc.file_url.startsWith("http")
        ? (doc.file_url.split("/process-documents/")[1] || doc.file_url)
        : doc.file_url;
      const { data: signed, error } = await supabase.storage
        .from("process-documents")
        .createSignedUrl(path, 60 * 10);
      if (error || !signed?.signedUrl) throw error || new Error("Não foi possível gerar pré-visualização");
      const type = doc.document_type === "pdf" || doc.file_url.endsWith(".pdf") ? "pdf" : (doc.document_type === "imagem" || doc.file_url.match(/\.(png|jpg|jpeg)$/i)) ? "image" : "other";
      setPreviewDoc({ type, url: signed.signedUrl, name: doc.document_name });
    } catch (e: any) {
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

      const ext = resubmitFile.name.split(".").pop();
      const ts = Date.now();
      const path = `${id}/${ts}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("process-documents")
        .upload(path, resubmitFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      // Tenta RPC primeiro para evitar bloqueios de RLS no UPDATE
      const { error: rpcErr1 } = await supabase.rpc("resubmit_rejected_document", {
        p_document_id: resubmitDoc.id,
        p_file_url: path,
        p_correction_justification: resubmitJustification.trim(),
      });
      if (rpcErr1) {
        // Fallback: tentar RPC antiga se existir
        const { error: rpcErr2 } = await supabase.rpc("resubmit_document", {
          _doc_id: resubmitDoc.id,
          _process_id: id,
          _file_url: path,
          _justification: resubmitJustification.trim(),
          _resubmitted_at: new Date().toISOString(),
        });
        if (!rpcErr2) {
          // RPC antiga funcionou, segue fluxo
        } else {
        // Fallback para UPDATE direto
        const { error: updErr } = await supabase
          .from("process_documents")
          .update({ 
            file_url: path, 
            status: "pending", 
            rejection_reason: null,
            correction_justification: resubmitJustification.trim(),
            resubmitted_at: new Date().toISOString(),
          })
          .eq("id", resubmitDoc.id)
          .eq("process_id", id);
        if (updErr) {
          const msg = (updErr as any)?.message || "";
          const details = (updErr as any)?.details || "";
          const hint = (updErr as any)?.hint || "";
          const missingNewCols = ["correction_justification", "resubmitted_at"].some(k => msg.includes(k) || details.includes(k) || hint.includes(k));
          if (missingNewCols) {
            // Fallback quando o banco remoto ainda não tem as novas colunas
            const { error: updErr2 } = await supabase
              .from("process_documents")
              .update({ 
                file_url: path, 
                status: "pending", 
                rejection_reason: null,
              })
              .eq("id", resubmitDoc.id)
              .eq("process_id", id);
            if (updErr2) throw updErr2;
          } else {
            throw updErr;
          }
        }
      }
      }

      await addToHistory(`Reenvio de documento: ${resubmitDoc.document_name}. Justificativa: ${resubmitJustification.trim()}`);

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
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Processo {process.process_number}</h1>
              <p className="text-sm text-muted-foreground">{process.company_name}</p>
            </div>
          </div>
          <StatusBadge status={process.current_status as any} />
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Process Info */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Informações do Processo</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{process.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Razão Social / Nome da Empresa</p>
                  <p className="font-medium">{process.company_name}</p>
                </div>
                {(() => {
                  const contact = getContactInfo();
                  return (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Nome completo</p>
                        <p className="font-medium">{contact.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p className="font-medium">{contact.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">E-mail</p>
                        <p className="font-medium">{contact.email || "—"}</p>
                      </div>
                    </>
                  );
                })()}
                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">{process.address}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {new Date(process.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Atualizado em</p>
                    <p className="font-medium">
                      {new Date(process.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Andamento do Processo</h2>
              <ProcessTimeline 
                currentStatus={process.current_status as any}
                history={history}
                attachments={documents}
                mode="user"
                onPreviewDoc={openPreviewForDoc as any}
                onDownloadDoc={handleDownload as any}
              />
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Documento Final Aprovado e Liberado */}
            {documents.some((d) => d.document_type === "certificado_final" && d.status === "completed" && !!d.disponivel_usuario) && (
              <Card className="p-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
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
            {/* Documents */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Documentos</h2>
                {(["cadastro","triagem","vistoria","exigencia"] as string[]).includes(process.current_status) ? (
                  <Dialog open={uploadOpen} onOpenChange={(open) => {
                    if (!open) {
                      // cleanup previews
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

              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum documento enviado</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden">
                        {/* Mini preview */}
                        {doc.document_type === "imagem" || doc.file_url.match(/\.(png|jpg|jpeg)$/i) ? (
                          <Button variant="ghost" size="icon" onClick={() => openPreviewForDoc(doc)}>
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </Button>
                        ) : doc.document_type === "pdf" || doc.file_url.endsWith(".pdf") ? (
                          <Button variant="ghost" size="icon" onClick={() => openPreviewForDoc(doc)}>
                            <FileText className="w-6 h-6 text-muted-foreground" />
                          </Button>
                        ) : (
                          <FileIcon className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.document_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                        <div className="mt-1">
                          <StatusBadge status={doc.status as any} type="step" />
                        </div>
                        {doc.status === "completed" && (
                          <p className="text-xs text-green-700 mt-1">✅ Documento aprovado — edição bloqueada</p>
                        )}
                        {doc.rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ {doc.rejection_reason}
                          </p>
                        )}
                        {/* Histórico de versões */}
                        {versionsByDoc[doc.id] && versionsByDoc[doc.id].length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-semibold">Versões do documento</p>
                            <div className="space-y-1">
                              {versionsByDoc[doc.id].map((v) => (
                                <div key={v.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">v{v.version_number}</span>
                                    <span className="capitalize">{v.status}</span>
                                    {v.status === 'rejected' && v.rejection_reason && (
                                      <span className="text-red-600">— {v.rejection_reason}</span>
                                    )}
                                    {v.status === 'pending' && v.correction_justification && (
                                      <span className="text-amber-700">— Justificativa: {v.correction_justification}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openPreviewForDoc({ ...doc, file_url: v.file_url })}>
                                      <Eye className="w-3 h-3 mr-1" /> Ver
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDownload({ ...doc, file_url: v.file_url })}>
                                      <Download className="w-3 h-3 mr-1" /> Baixar
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {doc.status === "rejected" && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              onClick={() => { setResubmitDoc(doc); setResubmitOpen(true); }}
                              disabled={resubmitting}
                            >
                              Corrigir e reenviar
                            </Button>
                          </div>
                        )}
                        {doc.status === "pending" && (
                          <p className="text-xs text-amber-600 mt-1">⏳ Documento aguardando análise — reenvio desativado</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openPreviewForDoc(doc)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </Button>
                        {/* Exclusão removida para manter rastreabilidade */}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Orientações de envio por etapa */}
              {process && (() => {
                const guidanceByStage: Record<string, { title: string; bullets: string[] }> = {
                  cadastro: {
                    title: "Documentos iniciais obrigatórios",
                    bullets: [
                      "Requerimento de Vistoria (formulário padrão CBM-PE, PDF)",
                      "Comprovante de inscrição no CNPJ (PDF)",
                      "Documento de identificação do responsável legal (PDF)",
                      "Comprovante de endereço do estabelecimento (PDF ou imagem)",
                      "Planta baixa / croqui simplificado do local (PDF)",
                    ],
                  },
                  vistoria: {
                    title: "Documentos para análise técnica / vistoria",
                    bullets: [
                      "ART (CREA/CAU) do responsável técnico vinculada ao projeto (PDF)",
                      "Projeto técnico de prevenção e combate a incêndio (PPCI) (PDF)",
                      "Memorial descritivo conforme norma do CBM-PE (PDF)",
                      "Laudos: SPDA, hidrantes/extintores, sinalização e iluminação de emergência (PDF)",
                      "Plantas: situação, baixa, cortes e detalhes de sistemas (PDF)",
                      "Relatório fotográfico do estabelecimento (JPG/PNG)",
                      "Plano de emergência / brigada, quando aplicável (PDF)",
                    ],
                  },
                  exigencia: {
                    title: "Correções exigidas nesta etapa",
                    bullets: [
                      "Reenvie os documentos reprovados usando ‘Corrigir e reenviar’",
                      "Inclua uma justificativa clara do atendimento às exigências",
                      "Atualize as versões dos arquivos e garanta legibilidade",
                    ],
                  },
                };
                const guidance = guidanceByStage[process.current_status];
                if (!guidance) return null;
                return (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="text-sm font-semibold">{guidance.title}</h4>
                    <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                      {guidance.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                    <p className="text-xs mt-2 text-muted-foreground">
                      Formatos aceitos: PDF, JPG, PNG, DOCX, XLSX (máx. 10MB por arquivo). Os itens podem variar conforme atividade e metragem; consulte as normas do CBM-PE.
                    </p>
                  </div>
                );
              })()}
            </Card>

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
          </div>
        </div>
      </main>
    </div>
  );
};

export default DetalheProcesso;
