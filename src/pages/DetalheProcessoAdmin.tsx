import { useEffect, useState } from "react";
import { dispatchStatusChange } from "@/integrations/notifications";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, FileText, Download, Check, X, AlertTriangle, ShieldCheck, Eye, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { useRole } from "@/hooks/useRole";
import { useIsMobile } from "@/hooks/use-mobile";

import type { ProcessStatus, StepStatus } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { StampModal } from "@/components/StampModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Process {
  id: string;
  process_number: string;
  company_name: string;
  cnpj: string;
  address: string;
  current_status: ProcessStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
  // Campos de contato podem não existir em bancos remotos não migrados
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  // Etapa 1 – Ocupação
  cnae_principal?: string;
  cnaes_secundarios?: string[];
  coscip_principal?: {
    cnae?: string;
    categoria?: string;
    vistoria?: string;
    taxa?: number;
    observacao?: string;
  };
  coscip_secundarios?: Array<{
    cnae: string;
    descricao_cnae?: string;
    coscip_categoria?: string;
    vistoria?: string;
    observacao?: string;
    taxa?: number;
  }>;
  // Etapa 2 – Taxa de Bombeiro
  taxa_bombeiro_valor?: number;
  taxa_bombeiro_pago?: boolean;
  // Etapa 3 – Endereço estruturado
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  areaConstruida?: number;
  tipoImovel?: string;
  multiPavimentos?: string;
  pontoReferencia?: string;
  areaTerreno?: number;
  latitude?: number;
  longitude?: number;
  tipoLogradouro?: string;
  acessoPublico?: string;
  observacoesEndereco?: string;
  // Etapa 4 – Memorial Preliminar
  tipoAtividade?: string;
  qtdPavimentos?: number;
  areaTotalConstruida?: number;
  tipoEstrutura?: string;
  hasExtintores?: string;
  hasIluminacaoEmerg?: string;
  hasSinalizacaoEmerg?: string;
  hasHidrantes?: string;
  hasSprinklers?: string;
  possuiPPCI?: string;
  memorialResumo?: string;
}

interface ProcessHistory {
  id: string;
  status: ProcessStatus;
  step_status: StepStatus;
  observations: string;
  responsible_name: string;
  created_at: string;
}

interface ProcessDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  status: StepStatus;
  rejection_reason: string;
  correction_justification?: string;
  resubmitted_at?: string;
  stage?: ProcessStatus | string;
  uploaded_at: string;
}

interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  file_url: string;
  status: StepStatus | string;
  rejection_reason?: string;
  correction_justification?: string;
  uploaded_at: string;
}

const statusFlow: Record<ProcessStatus, ProcessStatus> = {
  cadastro: "triagem",
  triagem: "vistoria",
  vistoria: "comissao",
  comissao: "aprovacao",
  aprovacao: "concluido",
  exigencia: "triagem", // Volta para triagem após correção
  concluido: "concluido", // Permanece concluído
};

const stepLabels: Record<ProcessStatus, string> = {
  cadastro: "Cadastro",
  analise_documentos: "Análise de Documentos",
  agendamento_vistoria: "Agendamento de Vistoria",
  vistoria_realizada: "Vistoria Realizada",
  emissao_certificado: "Emissão de Certificado",
  triagem: "Triagem",
  vistoria: "Vistoria",
  comissao: "Comissão",
  aprovacao: "Aprovação Final",
  exigencia: "Exigência",
  concluido: "Concluído",
};

const DetalheProcessoAdmin = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { role, loading: roleLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [process, setProcess] = useState<Process | null>(null);
  const [history, setHistory] = useState<ProcessHistory[]>([]);
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  
  // Dialog states
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ProcessDocument | null>(null);
  const [observations, setObservations] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [newStatus, setNewStatus] = useState<ProcessStatus>("cadastro");
  const [processing, setProcessing] = useState(false);
  const [approveObservation, setApproveObservation] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{ type: "image" | "pdf" | "other"; url: string; name: string } | null>(null);
  const [versionsByDoc, setVersionsByDoc] = useState<Record<string, DocumentVersion[]>>({});
  const [hasVersionsTable, setHasVersionsTable] = useState<boolean>(true);
  const [comparePreview, setComparePreview] = useState<{
    left: { type: "image" | "pdf" | "other"; url: string; name: string };
    right: { type: "image" | "pdf" | "other"; url: string; name: string };
    title: string;
  } | null>(null);
  // Carimbo interativo
  const [stampDoc, setStampDoc] = useState<ProcessDocument | null>(null);
  const [stampUrl, setStampUrl] = useState<string>("");
  const [stampOpen, setStampOpen] = useState(false);
  // Aprovação final
  const [finalDialog, setFinalDialog] = useState<"approve" | "reject" | null>(null);
  const [approverMatricula, setApproverMatricula] = useState("");
  const [approverPosto, setApproverPosto] = useState("");
  const [finalParecer, setFinalParecer] = useState("");
  const [finalRejectReason, setFinalRejectReason] = useState("");
  // Etapa selecionada na timeline (para resumo de status por etapa)
  const [selectedStage, setSelectedStage] = useState<ProcessStatus>("cadastro");

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

  // Calcula contadores de documentos (por etapa selecionada na timeline)
  const currentStage = process?.current_status || "cadastro";
  const selectedStageDocs = documents.filter(d => (d.stage || "cadastro") === selectedStage);
  const approvedCountSelected = selectedStageDocs.filter(d => d.status === "completed").length;
  const pendingCountSelected = selectedStageDocs.filter(d => d.status === "pending").length;
  const rejectedCountSelected = selectedStageDocs.filter(d => d.status === "rejected").length;
  // Documentos da etapa atual do processo (para lógica de aprovação de etapa)
  const stageDocsCurrent = documents.filter(d => (d.stage || "cadastro") === currentStage);
  const pendingCountCurrent = stageDocsCurrent.filter(d => d.status === "pending").length;
  const rejectedCountCurrent = stageDocsCurrent.filter(d => d.status === "rejected").length;
  // Permite aprovar etapa mesmo sem documentos (ex.: triagem sem anexos)
  const canApproveStage = (stageDocsCurrent.length === 0) || (pendingCountCurrent === 0 && rejectedCountCurrent === 0);
  // Considera certificado final como aprovação de etapa na aprovação final
  const hasFinalCertificate = documents.some(d => d.document_type === "certificado_final" && d.status === "completed");
  // Fallback: considerar histórico de carimbo/liberação mesmo que o status registrado seja 'concluido'
  const approvedByStampHistory = history.some(
    h => h.step_status === "completed" && (
      (h.observations || "").toLowerCase().includes("carimbado") ||
      (h.observations || "").toLowerCase().includes("liberado")
    )
  );
  const stageApproved = (
    history.some(
      h => h.status === currentStage && h.step_status === "completed" && (h.observations || "").toLowerCase().includes("etapa")
    )
    || (currentStage === "aprovacao" && (hasFinalCertificate || approvedByStampHistory))
  );
  // Nova regra: avançar etapa somente quando todos os documentos da etapa atual estiverem aprovados
  const allDocsApprovedCurrent = (stageDocsCurrent.length > 0) && (pendingCountCurrent === 0 && rejectedCountCurrent === 0);
  const canAdvancePhase = allDocsApprovedCurrent && process?.current_status !== "concluido";

  // Etapa ativa para ações de documentos durante exigência (usa última etapa do histórico)
  const stageStatuses: ProcessStatus[] = ["cadastro","triagem","vistoria","comissao","aprovacao","concluido"];
  const lastStageInHistory = [...history].reverse().find(h => stageStatuses.includes(h.status as ProcessStatus))?.status as ProcessStatus | undefined;
  const activeStageForActions: ProcessStatus = currentStage === "exigencia" ? (lastStageInHistory || "triagem") : currentStage;
  const isTriagemActions = activeStageForActions === "triagem";

  // Recalcula e atualiza o status geral do processo com base nos documentos da etapa ativa
  const recalcAndUpdateProcessStatus = async () => {
    try {
      if (!id) return;
      const freshDocs = await dynamodb.documents.getByProcessId(id);
      const stageForCheck = activeStageForActions;
      const stageDocs = (freshDocs || []).filter((d: any) => (d.stage || "cadastro") === stageForCheck);

      const todosAprovados = stageDocs.length > 0 && stageDocs.every((d: any) => d.status === "completed");
      const algumReprovado = stageDocs.some((d: any) => d.status === "rejected");
      const algumPendente = stageDocs.some((d: any) => d.status === "pending");

      let novoStatus: ProcessStatus = stageForCheck;
      if (algumReprovado) {
        novoStatus = "exigencia";
      } else if (todosAprovados) {
        novoStatus = stageForCheck; // Aguardando próxima etapa (UI)
      } else if (algumPendente) {
        novoStatus = stageForCheck; // Em análise (UI)
      }

      if (process?.current_status !== novoStatus) {
        await dynamodb.processes.update(id!, { current_status: novoStatus });
        fetchProcess();
        fetchHistory();
      }
    } catch (e) {
      console.warn("Falha ao recalcular status do processo (admin):", e);
    }
  };

  // Quando o processo carregar/alterar, sincroniza etapa selecionada com etapa atual
  useEffect(() => {
    if (process) {
      setSelectedStage(process.current_status);
    }
  }, [process]);

  useEffect(() => {
    if (!roleLoading) {
      if (role !== "admin") {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive",
        });
        navigate("/dashboard/admin");
        return;
      }
      if (id) {
        fetchProcess();
        fetchHistory();
        fetchDocuments();
      }
    }
  }, [id, roleLoading, role]);

  // Assinaturas Realtime para sincronização imediata entre Admin ↔ Usuário
  useEffect(() => {
    if (!id || role !== "admin") return;

    const channel = supabase.channel(`process-sync-admin-${id}`);

    // Processos: mudanças de etapa ou metadados
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'processes',
      filter: `id=eq.${id}`,
    }, () => {
      fetchProcess();
    });

    // Histórico: aprovar, reprovar, correção, reabrir
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'process_history',
      filter: `process_id=eq.${id}`,
    }, () => {
      fetchHistory();
    });

    // Documentos: usuário reenviou, admin aprovou/reprovou
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
  }, [id, role]);

  // Persistência do estado do bloco de informações (expandido/recolhido)
  useEffect(() => {
    if (!process) return;
    try {
      const key = `admin:processDetailsOpen:${process.id}`;
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        setDetailsOpen(saved === "true");
      }
    } catch {}
  }, [process]);

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
      navigate("/dashboard/admin");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: ProcessDocument) => {
    try {
      let downloadUrl = doc.file_url;

      // Se já é uma URL completa (S3 ou outra), usar diretamente
      if (!downloadUrl.startsWith("http")) {
        // Construir URL do S3 se variáveis estiverem definidas; caso contrário, gerar URL assinada do Supabase
        const S3_BUCKET = import.meta.env.VITE_S3_BUCKET;
        const S3_REGION = import.meta.env.VITE_AWS_REGION;
        const key = doc.file_url.startsWith("process-documents/")
          ? doc.file_url
          : `process-documents/${doc.file_url}`;

        if (S3_BUCKET && S3_REGION) {
          downloadUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
        } else {
          const { data: signed, error } = await supabase.storage
            .from('process-documents')
            .createSignedUrl(key, 60 * 10);
          if (error || !signed?.signedUrl) throw error || new Error('Não foi possível gerar link de download.');
          downloadUrl = signed.signedUrl;
        }
      }

      // Abrir em nova aba para visualização/download pelo navegador
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      toast({
        title: 'Erro ao baixar documento',
        description: error?.message || 'Não foi possível obter o arquivo.',
        variant: 'destructive',
      });
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
      // Se a tabela não existir no projeto remoto, evita log poluído e desativa recursos de versão
      if (msg.includes("Not Found") || msg.includes("404") || msg.includes("does not exist")) {
        setHasVersionsTable(false);
        setVersionsByDoc({});
        console.warn("Tabela process_document_versions ausente; recursos de versão desativados.");
        return;
      }
      console.error("Erro ao carregar versões (admin):", err);
    }
  };

  // Removido avanço automático; aprovação de etapa será explícita pelo admin

  const handleApproveDocument = async () => {
    console.log('🟢 handleApproveDocument called');
    console.log('Selected document:', selectedDocument);
    
    if (!selectedDocument) {
      console.error('No document selected');
      return;
    }
    
    setProcessing(true);
    try {
      console.log('Updating document status to completed...');
      await dynamodb.documents.update(selectedDocument.id, { 
        status: "completed",
        rejection_reason: null 
      });
      console.log('Document updated successfully');

      // Atualiza estado local via map para evitar sobrescrever a lista
      setDocuments(prev => prev.map(doc => 
        doc.id === selectedDocument.id ? { ...doc, status: "completed", rejection_reason: null } : doc
      ));

      // Add to history como atividade em análise da etapa
      console.log('Adding to history...');
      if (approveObservation.trim()) {
        await addToHistory("in_progress", `Documento "${selectedDocument.document_name}" aprovado. Observações: ${approveObservation.trim()}`);
      } else {
        await addToHistory("in_progress", `Documento "${selectedDocument.document_name}" aprovado`);
      }
      console.log('History added');

      // Notificação de aprovação do documento
      try {
        if (process) {
          const contact = getContactInfo();
          await dispatchStatusChange({
            processId: process.id,
            userId: process.user_id,
            currentStage: stepLabels[currentStage as ProcessStatus],
            event: "approved",
            contact,
            documentName: selectedDocument.document_name,
          });
        }
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificações de aprovação de documento:", notifyErr);
      }

      toast({
        title: "Documento aprovado!",
        description: "O documento foi marcado como aprovado.",
      });

      setActionDialog(null);
      setSelectedDocument(null);
      setApproveObservation("");
      
      console.log('Fetching documents...');
      // Pequeno delay para garantir consistência do DynamoDB
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchDocuments();
      await recalcAndUpdateProcessStatus();
      console.log('✅ Approve completed');
    } catch (error: any) {
      console.error('❌ Error approving document:', error);
      toast({
        title: "Erro ao aprovar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectDocument = async () => {
    console.log('🔴 handleRejectDocument called');
    console.log('Selected document:', selectedDocument);
    console.log('Rejection reason:', rejectionReason);
    
    if (!selectedDocument || !rejectionReason) {
      console.error('Missing document or rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      console.log('Updating document status to rejected...');
      await dynamodb.documents.update(selectedDocument.id, { 
        status: "rejected",
        rejection_reason: rejectionReason 
      });
      console.log('Document updated successfully');

      // Atualiza estado local via map para refletir reprovação
      setDocuments(prev => prev.map(doc => 
        doc.id === selectedDocument.id ? { ...doc, status: "rejected", rejection_reason: rejectionReason } : doc
      ));

      // Update process to exigencia
      console.log('Updating process to exigencia...');
      await dynamodb.processes.update(id!, { current_status: "exigencia" });
      console.log('Process updated successfully');

      // Add to history
      console.log('Adding to history...');
      await addToHistory("rejected", `Documento "${selectedDocument.document_name}" reprovado: ${rejectionReason}`);
      console.log('History added');

      // Dispara notificações por documento reprovado
      try {
        if (process) {
          console.log('Sending rejection notification...');
          const contact = getContactInfo();
          await dispatchStatusChange({
            processId: process.id,
            userId: process.user_id,
            currentStage: stepLabels[currentStage as ProcessStatus],
            event: "rejected",
            reason: rejectionReason,
            contact,
            documentName: selectedDocument.document_name,
          });
          console.log('Notification sent');
        }
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificações de reprovação:", notifyErr);
      }

      toast({
        title: "Documento reprovado",
        description: "O processo foi marcado como em exigência. O usuário deverá corrigir o documento.",
      });

      setActionDialog(null);
      setSelectedDocument(null);
      setRejectionReason("");
      fetchProcess();
      fetchDocuments();
      await recalcAndUpdateProcessStatus();
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Erro ao reprovar documento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openPreviewForDoc = async (doc: ProcessDocument) => {
    try {
      let previewUrl = doc.file_url;

      if (previewUrl.startsWith("http")) {
        // Usa a URL direta (S3 ou Supabase pública)
      } else {
        // Construir URL do S3 se disponível; caso contrário, gerar URL assinada do Supabase
        const S3_BUCKET = import.meta.env.VITE_S3_BUCKET;
        const S3_REGION = import.meta.env.VITE_AWS_REGION;
        const key = doc.file_url.startsWith("process-documents/")
          ? doc.file_url
          : `process-documents/${doc.file_url}`;

        if (S3_BUCKET && S3_REGION) {
          previewUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
        } else {
          const { data: signed, error } = await supabase.storage
            .from("process-documents")
            .createSignedUrl(key, 60 * 10);
          if (error || !signed?.signedUrl) throw error || new Error("Não foi possível gerar URL.");
          previewUrl = signed.signedUrl;
        }
      }

      const isImg = previewUrl.match(/\.(png|jpe?g)$/i);
      const isPdf = previewUrl.endsWith(".pdf");
      setPreviewDoc({ type: isImg ? "image" : isPdf ? "pdf" : "other", url: previewUrl, name: doc.document_name });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao abrir documento", description: e.message || "Não foi possível gerar preview", variant: "destructive" });
    }
  };

  const openPreviewForVersion = async (doc: ProcessDocument, v: DocumentVersion) => {
    try {
      let previewUrl = v.file_url;

      if (previewUrl.startsWith("http")) {
        // Usa a URL direta
      } else {
        const S3_BUCKET = import.meta.env.VITE_S3_BUCKET;
        const S3_REGION = import.meta.env.VITE_AWS_REGION;
        const key = v.file_url.startsWith("process-documents/")
          ? v.file_url
          : `process-documents/${v.file_url}`;

        if (S3_BUCKET && S3_REGION) {
          previewUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
        } else {
          const { data: signed, error } = await supabase.storage
            .from("process-documents")
            .createSignedUrl(key, 60 * 10);
          if (error || !signed?.signedUrl) throw error || new Error("Não foi possível gerar URL.");
          previewUrl = signed.signedUrl;
        }
      }

      const isImg = previewUrl.match(/\.(png|jpe?g)$/i);
      const isPdf = previewUrl.endsWith(".pdf");
      setPreviewDoc({ type: isImg ? "image" : isPdf ? "pdf" : "other", url: previewUrl, name: `${doc.document_name} (v${v.version_number})` });
    } catch (e: any) {
      toast({ title: "Erro ao abrir versão", description: e?.message || "Tente novamente.", variant: "destructive" });
    }
  };
  const openStampForDoc = async (doc: ProcessDocument) => {
    try {
      const path = doc.file_url.startsWith("http")
        ? (doc.file_url.split("/process-documents/")[1] || doc.file_url)
        : doc.file_url;
      const { data, error } = await supabase.storage
        .from("process-documents")
        .createSignedUrl(path, 60 * 15);
      if (error) throw error;
      setStampDoc(doc);
      setStampUrl(data.signedUrl);
      setStampOpen(true);
    } catch (e: any) {
      toast({ title: "Erro ao abrir carimbo", description: e.message || "Falha ao gerar URL temporária", variant: "destructive" });
    }
  };

  const handleStamped = async ({ blob, filename, code }: { blob: Blob; filename: string; code: string }) => {
    if (!process || !stampDoc) return;
    setProcessing(true);
    try {
      console.log('📄 Uploading stamped document to S3...');
      const path = `${process.id}/${stampDoc.id}/stamped/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("process-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      console.log('✅ Document uploaded to S3');

      // Atualizar processo para concluído
      console.log('🔄 Updating process to concluido...');
      await dynamodb.processes.update(process.id, { current_status: "concluido" });
      console.log('✅ Process updated');

      // Registrar no histórico
      console.log('📝 Adding to history...');
      await addToHistory(
        "completed",
        `Documento "${stampDoc.document_name}" carimbado e aprovado pelo CBM-PE. Código: ${code}.`
      );
      console.log('✅ History added');

      // Enviar notificação WhatsApp
      console.log('📱 Sending WhatsApp notification...');
      try {
        const contact = getContactInfo();
        await dispatchStatusChange({
          processId: process.id,
          userId: process.user_id,
          currentStage: stepLabels[currentStage as ProcessStatus],
          nextStage: "Concluído",
          event: "approved",
          contact,
        });
        console.log('✅ WhatsApp notification sent');
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificação de conclusão:", notifyErr);
      }

      toast({ title: "Processo concluído!", description: "Documento carimbado e usuário notificado." });
      setStampOpen(false);
      setStampDoc(null);
      setStampUrl("");
      await fetchDocuments();
      await fetchHistory();
      fetchProcess();
    } catch (e: any) {
      console.error('❌ Error stamping document:', e);
      toast({ title: "Erro ao salvar carimbo", description: e.message || "Falha ao persistir versão carimbada", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const openCompareForDoc = async (doc: ProcessDocument, newer: DocumentVersion, older: DocumentVersion) => {
    try {
      const makeSigned = async (fileUrl: string) => {
        const path = fileUrl.startsWith("http")
          ? (fileUrl.split("/process-documents/")[1] || fileUrl)
          : fileUrl;
        const { data: signed, error } = await supabase.storage
          .from("process-documents")
          .createSignedUrl(path, 60 * 10);
        if (error || !signed?.signedUrl) throw error || new Error("Falha ao gerar link.");
        const isImg = path.match(/\.(png|jpe?g)$/i);
        const isPdf = path.endsWith(".pdf");
        return { type: isImg ? "image" : isPdf ? "pdf" : "other", url: signed.signedUrl } as const;
      };

      const left = await makeSigned(newer.file_url);
      const right = await makeSigned(older.file_url);
      setComparePreview({
        left: { ...left, name: `${doc.document_name} v${newer.version_number}` },
        right: { ...right, name: `${doc.document_name} v${older.version_number}` },
        title: `Comparar versões: ${doc.document_name}`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao comparar versões", description: e?.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleAdvanceStage = async () => {
    console.log('🚀 handleAdvanceStage called');
    console.log('Process:', process);
    console.log('New status:', newStatus);
    console.log('Stage approved:', stageApproved);
    
    if (!process || !newStatus) {
      console.error('Missing process or newStatus');
      return;
    }

    setProcessing(true);
    try {
      // Nova regra: exige que todos os documentos da etapa atual estejam aprovados
      const docsOk = (stageDocsCurrent.length > 0) && (pendingCountCurrent === 0 && rejectedCountCurrent === 0);
      if (!docsOk) {
        console.log('Documents not fully approved yet');
        toast({
          title: "Documentos pendentes",
          description: "Aguarde a aprovação de todos os documentos para avançar.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }

      console.log('Updating process status to:', newStatus);
      await dynamodb.processes.update(id!, { current_status: newStatus });
      console.log('Update result: success');

      await addToHistory("completed", observations || `Etapa ${stepLabels[currentStage as ProcessStatus]} avançada para ${stepLabels[newStatus]}`);

      // Dispara notificações de aprovação de etapa com próxima etapa
      try {
        const contact = getContactInfo();
        await dispatchStatusChange({
          processId: process.id,
          userId: process.user_id,
          currentStage: stepLabels[currentStage as ProcessStatus],
          nextStage: stepLabels[newStatus as ProcessStatus],
          event: "approved",
          contact,
        });
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificações de avanço de etapa:", notifyErr);
      }

      toast({
        title: "Processo avançado!",
        description: `O processo foi movido para a etapa de ${newStatus}.`,
      });

      setActionDialog(null);
      setNewStatus("cadastro");
      setObservations("");
      fetchProcess();
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Erro ao avançar processo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveStage = async () => {
    if (!process) return;
    setProcessing(true);
    try {
      if (!canApproveStage) {
        toast({
          title: "Documentos pendentes",
          description: "Aprove todos os documentos desta etapa antes de aprovar a etapa.",
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }
      await addToHistory("completed", `Etapa ${stepLabels[currentStage as ProcessStatus]} aprovada`);
      toast({ title: "Etapa aprovada", description: "Próxima etapa desbloqueada para avanço." });
      fetchHistory();

      // Dispara notificação de aprovação da etapa atual
      try {
        const contact = getContactInfo();
        const next = statusFlow[currentStage as ProcessStatus];
        await dispatchStatusChange({
          processId: process.id,
          userId: process.user_id,
          currentStage: stepLabels[currentStage as ProcessStatus],
          nextStage: stepLabels[next],
          event: "approved",
          contact,
        });
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificações de aprovação de etapa:", notifyErr);
      }
    } catch (error: any) {
      toast({ title: "Erro ao aprovar etapa", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const generateVerificationCode = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const part = (len: number, charset: string) =>
      Array.from({ length: len }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
    return `${part(2, letters)}${part(2, digits)}-${part(2, digits)}${part(2, letters)}-${part(2, digits)}${part(2, letters)}`;
  };

  const handleFinalApproveAndStamp = async () => {
    if (!process) return;
    if (!approverMatricula.trim() || !approverPosto.trim()) {
      toast({
        title: "Dados do bombeiro obrigatórios",
        description: "Informe matrícula e posto/graduação para o carimbo.",
        variant: "destructive",
      });
      return;
    }
    setProcessing(true);
    try {
      const code = generateVerificationCode();
      const approvalDate = new Date();
      const qrUrl = `${window.location.origin}/verificar?codigo=${code}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 256 });

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const qrImage = await pdfDoc.embedPng(qrDataUrl);

      const drawText = (text: string, x: number, y: number, size = 12, bold = false) => {
        page.drawText(text, { x, y, size, font: bold ? helveticaBold : helvetica, color: rgb(0, 0, 0) });
      };

      // Cabeçalho
      drawText("CBM-PE • Certificado de Aprovação", 60, 800, 16, true);
      drawText(`Processo: ${process.process_number}`, 60, 775, 12);
      drawText(`Empresa: ${process.company_name}`, 60, 760, 12);
      if ((process as any).cnpj) drawText(`CNPJ: ${(process as any).cnpj}`, 60, 745, 12);

      // Parecer final
      if (finalParecer.trim()) {
        drawText("Parecer Final:", 60, 715, 12, true);
        const words = finalParecer.trim().split(/\s+/);
        let line = "";
        let y = 700;
        words.forEach((w) => {
          if ((line + " " + w).length > 80) {
            drawText(line, 60, y, 11);
            y -= 15;
            line = w;
          } else {
            line = line ? line + " " + w : w;
          }
        });
        if (line) drawText(line, 60, 685, 11);
      }

      // Carimbo digital
      drawText("Carimbo Digital", 60, 650, 12, true);
      drawText(`Matrícula: ${approverMatricula} • Posto: ${approverPosto}`, 60, 635, 11);
      drawText(`Data/Hora: ${approvalDate.toLocaleString("pt-BR")}`, 60, 620, 11);
      drawText(`Código de Verificação: ${code}`, 60, 605, 11);

      // QR Code
      page.drawImage(qrImage, { x: 60, y: 450, width: 120, height: 120 });
      drawText("Escaneie para validar o documento", 60, 430, 10);
      drawText(qrUrl, 60, 415, 9);

      // Rodapé
      drawText("Documento emitido e assinado digitalmente pelo CBM-PE.", 60, 80, 10);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      const path = `${process.id}/final/${code}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("process-documents")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      // Inserção robusta: tenta com metadados de liberação, e se falhar, insere apenas campos base
      const insertPayloadFull = {
        process_id: process.id,
        document_name: `Certificado Final – ${code}`,
        document_type: "certificado_final",
        status: "completed",
        file_url: path,
        rejection_reason: null,
        disponivel_usuario: true,
        carimbado_por: `${approverPosto} • Matrícula ${approverMatricula}`,
        data_carimbo: approvalDate.toISOString(),
      } as any;
      const insertPayloadBase = {
        process_id: process.id,
        document_name: `Certificado Final – ${code}`,
        document_type: "certificado_final",
        status: "completed",
        file_url: path,
        rejection_reason: null,
      } as any;
      let { error: docError } = await supabase
        .from("process_documents")
        .insert(insertPayloadFull);
      if (docError) {
        const { error: docError2 } = await supabase
          .from("process_documents")
          .insert(insertPayloadBase);
        if (docError2) throw docError2;
      }

      // Não avançamos automaticamente para concluído aqui; o carimbo manual passa a concluir o processo.

      await addToHistory(
        "completed",
        `Concluído e Documento Liberado para Download — Código: ${code}. ${finalParecer ? "Parecer: " + finalParecer + ". " : ""}Responsável: ${approverPosto} • Matrícula ${approverMatricula}.`
      );

      toast({
        title: "Processo aprovado e certificado emitido!",
        description: "O documento foi carimbado com QR Code e disponibilizado ao usuário.",
      });

      // Marca a etapa atual como aprovada para liberar o avanço
      await addToHistory("completed", `Etapa ${stepLabels[currentStage as ProcessStatus]} aprovada`);

      setFinalDialog(null);
      setApproverMatricula("");
      setApproverPosto("");
      setFinalParecer("");
      fetchProcess();
      fetchDocuments();
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Erro ao emitir certificado",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalReject = async () => {
    if (!process || !finalRejectReason.trim()) return;
    setProcessing(true);
    try {
      await dynamodb.processes.update(process.id, { current_status: "exigencia" });

      await addToHistory("rejected", `Processo reprovado na aprovação final: ${finalRejectReason}`);

      // Notificação de reprovação na etapa de Aprovação Final
      try {
        const contact = getContactInfo();
        await dispatchStatusChange({
          processId: process.id,
          userId: process.user_id,
          currentStage: stepLabels["aprovacao"],
          event: "rejected",
          reason: finalRejectReason,
          contact,
        });
      } catch (notifyErr) {
        console.warn("Falha ao enviar notificações de reprovação final:", notifyErr);
      }

      toast({
        title: "Processo reprovado e retornado ao usuário",
        description: "O usuário foi notificado para corrigir e reenviar.",
      });

      setFinalDialog(null);
      setFinalRejectReason("");
      fetchProcess();
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Erro ao reprovar processo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const addToHistory = async (stepStatus: StepStatus, obs: string) => {
    console.log('📝 addToHistory called:', { stepStatus, obs });
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User:', user?.id);
    console.log('Process:', process?.id);
    
    if (!user || !process) {
      console.warn('⚠️ Missing user or process, skipping history');
      return;
    }

    // Tentar buscar o perfil, mas não falhar se não existir
    let responsibleName = "Administrador";
    try {
      const profile = await dynamodb.profiles.getById(user.id);
      if (profile?.full_name) {
        responsibleName = profile.full_name;
      }
    } catch (error) {
      console.log('Profile not found, using default name');
    }

    console.log('Creating history entry...');
    await dynamodb.history.create({
      process_id: id!,
      status: process.current_status,
      step_status: stepStatus,
      observations: obs,
      responsible_id: user.id,
      responsible_name: responsibleName,
    });
    console.log('✅ History entry created');
  };

  if (loading || roleLoading) {
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
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/admin")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/7/7c/NOVO_BRAS%C3%83O_2024_CBMPE.png"
              alt="Corpo de Bombeiro Militar de Pernambuco"
              className="w-20 h-20 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">Processo {process.process_number}</h1>
              <p className="text-sm text-muted-foreground">{process.company_name}</p>
            </div>
          </div>
          <StatusBadge status={process.current_status} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !detailsOpen;
              setDetailsOpen(next);
              try {
                const key = `admin:processDetailsOpen:${process?.id}`;
                localStorage.setItem(key, String(next));
              } catch {}
            }}
          >
            <FileText className="w-4 h-4 mr-2" /> {detailsOpen ? "Ocultar Detalhes" : "Ver Detalhes"}
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Mini cards de Status dos Documentos */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4 rounded-2xl shadow-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">✅ Aprovados</span>
                <span className="text-xl font-bold text-green-700 dark:text-green-400">{approvedCountSelected}</span>
              </div>
            </Card>
            <Card className="p-4 rounded-2xl shadow-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">⏳ Pendentes</span>
                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{pendingCountSelected}</span>
              </div>
            </Card>
            <Card className="p-4 rounded-2xl shadow-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">❌ Reprovados</span>
                <span className="text-xl font-bold text-red-700 dark:text-red-400">{rejectedCountSelected}</span>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Process Info */}
            <Collapsible open={detailsOpen} onOpenChange={(open) => {
              setDetailsOpen(open);
              try {
                const key = `admin:processDetailsOpen:${process?.id}`;
                localStorage.setItem(key, String(open));
              } catch {}
            }}>
              <Card className="p-6 rounded-2xl shadow-md">
                <h2 className="text-xl font-bold mb-4">Informações do Processo</h2>
                <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">CNPJ</p>
                      <p className="font-medium">{process.cnpj}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status Atual</p>
                      <div className="mt-1">
                        <span className="font-medium capitalize">{process.current_status}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
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
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">{process.address}</p>
                    </div>
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

                  {/* Abas com Etapas 1 a 4 */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Dados do Cadastro (Etapas 1 a 4)</h3>
                    <Tabs defaultValue="ocupacao">
                      <TabsList>
                        <TabsTrigger value="ocupacao">1 Ocupação</TabsTrigger>
                        <TabsTrigger value="taxa">2 Taxa de Bombeiro</TabsTrigger>
                        <TabsTrigger value="endereco">3 Endereço</TabsTrigger>
                        <TabsTrigger value="memorial">4 Memorial Preliminar</TabsTrigger>
                      </TabsList>

                      <TabsContent value="ocupacao">
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-sm text-muted-foreground">CNAE Principal</p>
                            <p className="font-medium">{process.cnae_principal || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">CNAEs Secundários</p>
                            <p className="font-medium">{(process.cnaes_secundarios && process.cnaes_secundarios.length > 0) ? process.cnaes_secundarios.join(", ") : "—"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">COSCIP — Principal</p>
                            <div className="text-sm mt-1 space-y-1">
                              <p><strong>CNAE:</strong> {process.coscip_principal?.cnae || process.cnae_principal || "—"}</p>
                              <p><strong>Categoria:</strong> {process.coscip_principal?.categoria || "—"}</p>
                              <p><strong>Vistoria:</strong> {process.coscip_principal?.vistoria || "—"}</p>
                              <p><strong>Taxa:</strong> {typeof process.coscip_principal?.taxa === "number" ? process.coscip_principal!.taxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
                              <p><strong>Observação:</strong> {process.coscip_principal?.observacao || "—"}</p>
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">COSCIP — Secundários</p>
                            {Array.isArray(process.coscip_secundarios) && process.coscip_secundarios.length > 0 ? (
                              <div className="mt-1 space-y-2">
                                {process.coscip_secundarios.map((c, idx) => (
                                  <div key={idx} className="text-sm">
                                    <p><strong>CNAE:</strong> {c.cnae}</p>
                                    <p><strong>Categoria:</strong> {c.coscip_categoria || "—"}</p>
                                    <p><strong>Vistoria:</strong> {c.vistoria || "—"}</p>
                                    <p><strong>Taxa:</strong> {typeof c.taxa === "number" ? c.taxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p>
                                    <p><strong>Observação:</strong> {c.observacao || "—"}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-medium">—</p>
                            )}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="taxa">
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Valor da Taxa</p>
                            <p className="font-medium">
                              {typeof process.taxa_bombeiro_valor === "number"
                                ? process.taxa_bombeiro_valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                : (typeof process.coscip_principal?.taxa === "number"
                                  ? process.coscip_principal!.taxa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                  : "—")}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Pagamento</p>
                            <p className="font-medium">{process.taxa_bombeiro_pago ? "Pago" : "Não pago"}</p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="endereco">
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">Endereço (texto livre)</p>
                            <p className="font-medium">{process.address || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">CEP</p>
                            <p className="font-medium">{process.cep || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Logradouro</p>
                            <p className="font-medium">{process.logradouro || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Número</p>
                            <p className="font-medium">{process.numero || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Complemento</p>
                            <p className="font-medium">{process.complemento || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Bairro</p>
                            <p className="font-medium">{process.bairro || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cidade</p>
                            <p className="font-medium">{process.cidade || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">UF</p>
                            <p className="font-medium">{process.uf || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tipo de Imóvel</p>
                            <p className="font-medium">{process.tipoImovel || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Multi-pavimentos</p>
                            <p className="font-medium">{process.multiPavimentos || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Área Construída (m²)</p>
                            <p className="font-medium">{typeof process.areaConstruida === "number" ? process.areaConstruida : "—"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">Observações / Ponto de Referência</p>
                            <p className="font-medium">{process.pontoReferencia || process.observacoesEndereco || "—"}</p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="memorial">
                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Tipo de Atividade</p>
                            <p className="font-medium">{process.tipoAtividade || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Quantidade de Pavimentos</p>
                            <p className="font-medium">{typeof process.qtdPavimentos === "number" ? process.qtdPavimentos : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Área Total Construída (m²)</p>
                            <p className="font-medium">{typeof process.areaTotalConstruida === "number" ? process.areaTotalConstruida : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tipo de Estrutura</p>
                            <p className="font-medium">{process.tipoEstrutura || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Extintores</p>
                            <p className="font-medium">{process.hasExtintores === "sim" ? "Sim" : process.hasExtintores === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Iluminação de Emergência</p>
                            <p className="font-medium">{process.hasIluminacaoEmerg === "sim" ? "Sim" : process.hasIluminacaoEmerg === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Sinalização de Emergência</p>
                            <p className="font-medium">{process.hasSinalizacaoEmerg === "sim" ? "Sim" : process.hasSinalizacaoEmerg === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Hidrantes</p>
                            <p className="font-medium">{process.hasHidrantes === "sim" ? "Sim" : process.hasHidrantes === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Sprinklers</p>
                            <p className="font-medium">{process.hasSprinklers === "sim" ? "Sim" : process.hasSprinklers === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Possui PPCI</p>
                            <p className="font-medium">{process.possuiPPCI === "sim" ? "Sim" : process.possuiPPCI === "nao" ? "Não" : "—"}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">Resumo do Memorial</p>
                            <p className="font-medium">{process.memorialResumo || "—"}</p>
                          </div>

                          {/* Documentos de Memorial (se houver) */}
                          <div className="md:col-span-2">
                            <p className="text-sm text-muted-foreground">Arquivos de Memorial Técnico</p>
                            {documents && documents.filter(d => (d.document_name || '').toLowerCase().includes('memorial')).length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {documents.filter(d => (d.document_name || '').toLowerCase().includes('memorial')).map((doc) => (
                                  <div key={doc.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                                    <div className="flex items-center gap-2">
                                      {doc.document_type === 'imagem' ? <ImageIcon className="w-4 h-4" /> : (doc.document_type === 'pdf' ? <FileIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />)}
                                      <span className="text-sm font-medium">{doc.document_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button variant="secondary" size="sm" onClick={() => openPreviewForDoc(doc)}>
                                        <Eye className="w-3 h-3 mr-1" /> Ver
                                      </Button>
                                      <Button variant="secondary" size="sm" onClick={() => handleDownload(doc)}>
                                        <Download className="w-3 h-3 mr-1" /> Baixar
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-medium">—</p>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Timeline */}
            <ProcessTimeline 
              currentStatus={process.current_status}
              history={history}
              mode="admin"
              attachments={documents}
              onPreviewDoc={openPreviewForDoc as any}
              onDownloadDoc={handleDownload as any}
              onSelectStage={(status) => setSelectedStage(status)}
            />

          </div>
          {/* Ações Administrativas e Documentos abaixo da timeline */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 rounded-2xl shadow-md">
              <h2 className="text-lg font-bold mb-4">Ações Administrativas</h2>
              <div className="space-y-3">
                {process.current_status === "aprovacao" && (
                  <div className="space-y-2">
                    <Button className="w-full" onClick={() => {
                      const approvedPdf = documents.find(d => d.status === "completed" && d.file_url.endsWith(".pdf"));
                      if (approvedPdf) {
                        openStampForDoc(approvedPdf);
                      } else {
                        toast({ title: "Nenhum PDF aprovado", description: "Aprove um PDF para carimbar.", variant: "destructive" });
                      }
                    }}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Carimbar Documento
                    </Button>
                    <Button className="w-full" variant="destructive" onClick={() => setFinalDialog("reject")}>
                      <X className="w-4 h-4 mr-2" />
                      Reprovar e retornar
                    </Button>
                  </div>
                )}

                {canAdvancePhase && process.current_status !== "concluido" ? (
                  <Button 
                    className={`w-full ${isMobile ? "h-9 px-3 text-sm" : ""}`}
                    size={isMobile ? "sm" : "default"}
                    onClick={() => {
                      console.log('🔄 Avançar etapa clicked');
                      console.log('Current status:', process.current_status);
                      console.log('Status flow:', statusFlow);
                      const nextStatus = statusFlow[process.current_status];
                      console.log('Next status:', nextStatus);
                      if (nextStatus) {
                        setNewStatus(nextStatus);
                        setActionDialog("advance");
                        console.log('Dialog opened');
                      } else {
                        console.error('No next status found!');
                      }
                    }}
                  >
                    <Check className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} mr-2`} />
                    {isMobile ? "Avançar Etapa" : "Avançar para Próxima Etapa"}
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button className={`w-full ${isMobile ? "h-9 px-3 text-sm" : ""}`} size={isMobile ? "sm" : "default"} disabled>
                            <Check className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} mr-2`} />
                            Avançar Etapa
                          </Button>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stageApproved ? (
                          <p className="font-medium">Próxima etapa ainda não habilitada</p>
                        ) : (
                          <>
                            <p className="font-medium">Aguarde a aprovação de todos os documentos para liberar o avanço</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {pendingCountCurrent > 0 && `${pendingCountCurrent} pendente(s)`}
                              {pendingCountCurrent > 0 && rejectedCountCurrent > 0 && " • "}
                              {rejectedCountCurrent > 0 && `${rejectedCountCurrent} reprovado(s)`}
                            </p>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                

                
                {(pendingCountCurrent > 0 || rejectedCountCurrent > 0) && (
                  <p className="text-xs text-muted-foreground text-center p-2 bg-muted/50 rounded">
                    💡 Analise os documentos abaixo para avançar o processo
                  </p>
                )}
              </div>
            </Card>
            {/* Documentos */}
            <Card className="p-6 rounded-2xl shadow-md">
              <h2 className="text-lg font-bold mb-4">Documentos</h2>
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum documento enviado</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {doc.file_url.match(/\.(png|jpe?g)$/i) ? (
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          ) : doc.file_url.endsWith(".pdf") ? (
                            <FileText className="w-6 h-6 text-muted-foreground" />
                          ) : (
                            <FileIcon className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                          <div className="mt-2">
                            <StatusBadge status={doc.status} type="step" />
                          </div>
                          {doc.rejection_reason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800">
                              ⚠️ {doc.rejection_reason}
                            </p>
                          )}
                          {doc.correction_justification && (
                            <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded border border-border">
                              ✏️ Justificativa do usuário: {doc.correction_justification}
                              {doc.resubmitted_at ? (
                                <span className="block text-[11px] mt-1">Reenviado em {new Date(doc.resubmitted_at).toLocaleString("pt-BR")}</span>
                              ) : null}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openPreviewForDoc(doc)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                          <Download className="w-4 h-4 mr-1" /> Baixar
                        </Button>
                        {doc.status === "completed" && doc.file_url.endsWith(".pdf") && process?.current_status === "aprovacao" && (
                          <Button size="sm" onClick={() => openStampForDoc(doc)}>
                            <ShieldCheck className="w-4 h-4 mr-1" /> Carimbar
                          </Button>
                        )}
                      </div>
                      {versionsByDoc[doc.id] && versionsByDoc[doc.id].length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold">Versões</p>
                          <div className="space-y-1">
                            {versionsByDoc[doc.id].map((v, idx, arr) => (
                              <div key={v.id} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">v{v.version_number}</span>
                                  <span className="capitalize">{v.status}</span>
                                  {v.file_url.includes("Documento_Carimbado_") && (
                                    <span className="ml-2 px-2 py-[2px] rounded bg-green-100 text-green-700">Carimbado</span>
                                  )}
                                  {v.status === 'rejected' && v.rejection_reason && (
                                    <span className="text-red-600">— {v.rejection_reason}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openPreviewForVersion(doc, v)}>
                                    <Eye className="w-3 h-3 mr-1" /> Ver
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDownload({ ...doc, file_url: v.file_url })}>
                                    <Download className="w-3 h-3 mr-1" /> Baixar
                                  </Button>
                                  {idx > 0 && (
                                    <Button variant="ghost" size="sm" onClick={() => openCompareForDoc(doc, v, arr[idx-1])}>
                                      Comparar com anterior
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {doc.status === "pending" && (
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-1">
                                  <Button
                                    size={isMobile ? "sm" : "default"}
                                    className={`w-full ${isMobile ? "h-8 px-2 text-xs" : ""}`}
                                    disabled={!isTriagemActions && (doc.stage || "cadastro") !== activeStageForActions}
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setActionDialog("approve");
                                    }}
                                  >
                                    <Check className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} mr-1`} /> Aprovar
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {(doc.stage || "cadastro") !== activeStageForActions && !isTriagemActions && (
                                <TooltipContent>
                                  <p className="text-sm">Documento fora da etapa em análise ({doc.stage || "cadastro"}).</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            size={isMobile ? "sm" : "default"}
                            variant="destructive"
                            className={`flex-1 ${isMobile ? "h-8 px-2 text-xs" : ""}`}
                            disabled={!isTriagemActions && (doc.stage || "cadastro") !== activeStageForActions}
                            onClick={() => {
                              setSelectedDocument(doc);
                              setActionDialog("reject");
                            }}
                          >
                            <X className={`${isMobile ? "w-3 h-3" : "w-4 h-4"} mr-1`} /> Reprovar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

            {/* Bloco de envio removido conforme solicitação */}
        </div>
      </main>

      {/* Dialogs */}
      {/* Approve Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={(open) => {
        if (!open) {
          setActionDialog(null);
          setApproveObservation("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Documento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja aprovar o documento "{selectedDocument?.document_name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approve-observation">Observações (opcional)</Label>
              <Textarea id="approve-observation" rows={3} value={approveObservation} onChange={(e) => setApproveObservation(e.target.value)} placeholder="Adicione observações relacionadas ao documento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              console.log('🔵 Approve button clicked!');
              handleApproveDocument();
            }} disabled={processing}>
              {processing ? "Aprovando..." : "Aprovar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Approve Dialog */}
      <Dialog open={finalDialog === "approve"} onOpenChange={(open) => !open && setFinalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovação Final e Carimbo Digital</DialogTitle>
            <DialogDescription>
              Informe os dados do bombeiro responsável e (opcional) parecer final.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula *</Label>
              <Input id="matricula" value={approverMatricula} onChange={(e) => setApproverMatricula(e.target.value)} placeholder="Ex.: 12345" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="posto">Posto/Graduação *</Label>
              <Input id="posto" value={approverPosto} onChange={(e) => setApproverPosto(e.target.value)} placeholder="Ex.: Cap." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parecer">Parecer Final (opcional)</Label>
              <Textarea id="parecer" rows={4} value={finalParecer} onChange={(e) => setFinalParecer(e.target.value)} placeholder="Insira observações e parecer final..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalDialog(null)}>Cancelar</Button>
            <Button onClick={handleFinalApproveAndStamp} disabled={processing || !approverMatricula.trim() || !approverPosto.trim()}>
              {processing ? "Emitindo..." : "Aprovar e emitir certificado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualização: {previewDoc?.name}</DialogTitle>
          </DialogHeader>
          {previewDoc?.type === "image" ? (
            <img src={previewDoc.url} alt={previewDoc.name} className="w-full h-auto" />
          ) : previewDoc?.type === "pdf" ? (
            <iframe src={previewDoc.url} className="w-full h-[70vh]" title="PDF Preview" />
          ) : (
            <div className="text-sm text-muted-foreground">Pré-visualização não disponível. Use o botão Baixar.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare Versions Modal */}
            <Dialog open={!!comparePreview} onOpenChange={(open) => !open && setComparePreview(null)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{comparePreview?.title}</DialogTitle>
          </DialogHeader>
          {comparePreview && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium mb-2">Esquerda: {comparePreview.left.name}</p>
                {comparePreview.left.type === "image" ? (
                  <img src={comparePreview.left.url} alt={comparePreview.left.name} className="w-full h-auto" />
                ) : comparePreview.left.type === "pdf" ? (
                  <iframe src={comparePreview.left.url} className="w-full h-[70vh]" title="PDF Left" />
                ) : (
                  <div className="text-sm text-muted-foreground">Visualização não disponível.</div>
                )}
              </div>
              <div>
                <p className="text-xs font-medium mb-2">Direita: {comparePreview.right.name}</p>
                {comparePreview.right.type === "image" ? (
                  <img src={comparePreview.right.url} alt={comparePreview.right.name} className="w-full h-auto" />
                ) : comparePreview.right.type === "pdf" ? (
                  <iframe src={comparePreview.right.url} className="w-full h-[70vh]" title="PDF Right" />
                ) : (
                  <div className="text-sm text-muted-foreground">Visualização não disponível.</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
            </Dialog>

            {stampDoc && (
              <StampModal
                open={stampOpen}
                onOpenChange={(open) => {
                  setStampOpen(open);
                  if (!open) {
                    setStampDoc(null);
                    setStampUrl("");
                  }
                }}
                pdfUrl={stampUrl}
                processId={process?.id || ""}
                processNumber={process?.process_number}
                companyName={process?.company_name}
                documentName={stampDoc.document_name}
                approverMatricula={approverMatricula}
                approverPosto={approverPosto}
                onStamped={async ({ blob, filename, code }) => handleStamped({ blob, filename, code })}
              />
            )}

      {/* Final Reject Dialog */}
      <Dialog open={finalDialog === "reject"} onOpenChange={(open) => !open && setFinalDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar e retornar ao usuário</DialogTitle>
            <DialogDescription>
              Informe o motivo para retorno. O processo será movido para exigência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea id="motivo" rows={4} value={finalRejectReason} onChange={(e) => setFinalRejectReason(e.target.value)} placeholder="Descreva o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFinalReject} disabled={processing || !finalRejectReason.trim()}>
              {processing ? "Reprovando..." : "Reprovar processo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === "reject"} onOpenChange={(open) => {
        if (!open) {
          setActionDialog(null);
          setRejectionReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar Documento</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação do documento "{selectedDocument?.document_name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Reprovação *</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Descreva o motivo da reprovação..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionDialog(null);
              setRejectionReason("");
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                console.log('🔴 Reject button clicked!');
                handleRejectDocument();
              }}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? "Reprovando..." : "Reprovar Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={actionDialog === "advance"} onOpenChange={(open) => {
        if (!open) {
          setActionDialog(null);
          setObservations("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avançar Processo</DialogTitle>
            <DialogDescription>
              O processo será movido para a etapa de {newStatus}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="observations">Observações (opcional)</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Adicione observações sobre esta mudança de etapa..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setActionDialog(null);
              setObservations("");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleAdvanceStage} disabled={processing}>
              {processing ? "Avançando..." : "Avançar Etapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetalheProcessoAdmin;
