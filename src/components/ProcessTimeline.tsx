import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus, SearchCheck, ClipboardList, Users, CheckCircle, Award, AlertCircle, Clock, Paperclip, Image as ImageIcon, FileText, File as FileIcon, Eye, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ProcessStatus = 
  | "cadastro" 
  | "triagem" 
  | "vistoria" 
  | "comissao" 
  | "aprovacao" 
  | "concluido"
  | "exigencia";

interface ProcessHistory {
  id: string;
  status: string;
  step_status: string;
  observations?: string;
  responsible_name?: string;
  created_at: string;
}

interface TimelineStep {
  status: ProcessStatus;
  label: string;
  icon: any;
}

interface AttachedDoc {
  id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  status: string;
  // Campos opcionais usados para controlar disponibilidade ao usuário e metadados
  disponivel_usuario?: boolean;
  stage?: string;
  carimbado_por?: string | null;
  data_carimbo?: string | null;
}

interface ProcessTimelineProps {
  currentStatus: ProcessStatus;
  history?: ProcessHistory[];
  className?: string;
  mode?: "user" | "admin";
  attachments?: AttachedDoc[];
  // Callbacks para preview e download dos anexos
  onPreviewDoc?: (doc: AttachedDoc) => void;
  onDownloadDoc?: (doc: AttachedDoc) => void;
  // Callback opcional para seleção de etapa na timeline (admin)
  onSelectStage?: (status: ProcessStatus) => void;
}

const timelineSteps: TimelineStep[] = [
  { status: "cadastro", label: "Entrada", icon: FilePlus },
  { status: "triagem", label: "Triagem", icon: SearchCheck },
  { status: "comissao", label: "Alocação de Viabilidade", icon: Users },
  { status: "vistoria", label: "Vistoria", icon: ClipboardList },
  { status: "aprovacao", label: "Emissão AVCB", icon: CheckCircle },
];

export const ProcessTimeline = ({ currentStatus, history = [], className, mode = "user", attachments = [], onPreviewDoc, onDownloadDoc, onSelectStage }: ProcessTimelineProps) => {
  const stageStatuses = timelineSteps.map(s => s.status);

  // Quando estiver em exigência, fixamos a etapa ativa como Triagem (independente do histórico)
  const lastStageInHistory = [...history].reverse().find(h => stageStatuses.includes(h.status as ProcessStatus));
  const activeStage: ProcessStatus = currentStatus === "exigencia" ? "triagem" : currentStatus;
  const activeIndex = timelineSteps.findIndex((step) => step.status === activeStage);
  const hasExigencia = currentStatus === "exigencia";
  const resolvedActiveIndex = activeIndex === -1 ? (timelineSteps.length - 1) : activeIndex;
  const isConcludedProcess = currentStatus === "concluido";

  const getStepHistory = (status: string) => {
    return history.filter(h => h.status === status);
  };

  const isStageApproved = (status: ProcessStatus) => {
    // Histórico explícito de aprovação de etapa
    const approvedByHistory = history.some(
      h => h.status === status && h.step_status === "completed" && (h.observations || "").toLowerCase().includes("etapa")
    );

    // Aprovação final: certificado emitido conta como etapa concluída
    const approvedByCertificate = status === "aprovacao"
      && attachments?.some(a => a.document_type === "certificado_final" && a.status === "completed");

    // Fallback: considerar histórico de carimbo/liberação mesmo que tenha sido salvo com status 'concluido'
    const approvedByStampHistory = status === "aprovacao" && history.some(
      h => h.step_status === "completed" && ((h.observations || "").toLowerCase().includes("carimbado") || (h.observations || "").toLowerCase().includes("liberado"))
    );
    return approvedByHistory || approvedByCertificate || approvedByStampHistory;
  };

  // Filtra anexos relevantes para uma etapa específica
  const getStepAttachments = (status: ProcessStatus) => {
    if (!attachments || attachments.length === 0) return [] as AttachedDoc[];
    // Emissão AVCB: mostrar certificado final e anexos marcados para aprovação (compatível com registros antigos em 'concluido')
    if (status === "aprovacao") {
      return attachments.filter((doc) => {
        const isFinalCert = doc.document_type === "certificado_final" && doc.status === "completed" && (mode === "admin" || !!doc.disponivel_usuario);
        const isMarkedApproval = ["aprovacao", "concluido"].includes((doc.stage || ""));
        return isFinalCert || isMarkedApproval;
      });
    }
    // Demais etapas: por ora não exibir anexos (reduz ruído)
    return [] as AttachedDoc[];
  };

  const getStepStatus = (index: number) => {
    if (isConcludedProcess) return "completed";
    if (hasExigencia && index === resolvedActiveIndex) {
      return "exigencia";
    }
    if (index < resolvedActiveIndex) return "completed";
    if (index === resolvedActiveIndex) return "in_progress";
    return "pending";
  };

  const formatStepStatus = (stepStatus: string) => {
    switch (stepStatus) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em andamento";
      case "completed":
        return "Concluído";
      case "rejected":
        return "Reprovado";
      case "resubmitted":
        return "Corrigido / reenviado";
      default:
        return stepStatus.replace("_", " ");
    }
  };

  const tooltipTextUser: Record<ProcessStatus, string> = {
    cadastro: "Preencha dados e envie o formulário. Protocolo gerado.",
    triagem: "Aguarde análise da triagem. Corrija se houver exigência.",
    vistoria: "Aguarde agendamento e realização da vistoria.",
    comissao: "Aguarde validação da comissão técnica.",
    aprovacao: "Homologação final e emissão do documento.",
    concluido: "Processo finalizado. Documento liberado para download.",
    exigencia: "Há exigências pendentes para correção.",
  };

  const tooltipTextAdmin: Record<ProcessStatus, string> = {
    cadastro: "Processo criado. Documentos iniciais enviados.",
    triagem: "Verifique documentos. Aprove ou gere exigência.",
    vistoria: "Analise técnica/campo. Aprove ou exija correções.",
    comissao: "Revise parecer do vistoriador. Decida.",
    aprovacao: "Chefia homologa e aplica carimbo digital.",
    concluido: "Processo concluído. Documento liberado ao usuário.",
    exigencia: "Processo em exigência. Aguardando usuário.",
  };

  const isAdmin = mode === "admin";

  return (
    <Card className={cn("p-6", className)}>
      <h3 className="text-lg font-semibold mb-6">Timeline do Processo</h3>

      {hasExigencia && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Processo em Exigência</h4>
            <p className="text-sm text-red-700 mt-1">
              Há documentos que precisam de correção. Verifique os detalhes e reenvie.
            </p>
          </div>
        </div>
      )}

      {/* Timeline horizontal */}
      <div className="w-full">
        <div className="flex items-center px-2">
          {timelineSteps.map((step, index) => {
            const stepStatus = getStepStatus(index);
            const isCompleted = stepStatus === "completed";
            const isCurrent = stepStatus === "in_progress";
            const isExigencia = stepStatus === "exigencia" && index === resolvedActiveIndex;
            const isPending = stepStatus === "pending";
            const stepHistory = getStepHistory(step.status);
            const tooltipText = mode === "admin" ? tooltipTextAdmin[step.status] : tooltipTextUser[step.status];

            let StepIcon = Clock;
            if (isCompleted) {
              StepIcon = CheckCircle;
            } else if (isCurrent || isExigencia) {
              StepIcon = AlertCircle;
            }

            const stepAttachments = getStepAttachments(step.status);
            const attachmentsCount = stepAttachments.length;

            const StepNode = (
              <div className="relative flex flex-col items-center">
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full transition-all duration-300 w-10 h-10",
                    isCompleted && "bg-green-600 text-white",
                    (isCurrent || isExigencia) && "bg-red-600 text-white",
                    isPending && "bg-gray-400 text-gray-700",
                  )}
                >
                  <StepIcon className="w-5 h-5" />
                </div>
                <div className="mt-2 text-center">
                  <h4 className="font-medium text-sm text-gray-800">{step.label}</h4>
                  <p className={cn(
                    "text-xs mt-1",
                    isCompleted && "text-green-700",
                    (isCurrent || isExigencia) && "text-red-700",
                    isPending && "text-gray-500"
                  )}>
                    {isCompleted && "✅ Concluída"}
                    {(isCurrent || isExigencia) && "🔴 Em andamento"}
                    {isPending && "⚪ Pendente"}
                  </p>
                  {attachmentsCount > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center">
                      <Paperclip className="w-3 h-3 mr-1" /> {attachmentsCount} anexo(s)
                    </p>
                  )}
                </div>
              </div>
            );

            const NodeWithDialog = (stepHistory.length > 0 || attachmentsCount > 0) ? (
              <Dialog key={step.status}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <div className="cursor-pointer hover:opacity-90 transition" onClick={() => onSelectStage?.(step.status)}>
                          {StepNode}
                        </div>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[280px] text-xs">{tooltipText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Etapa: {step.label}</DialogTitle>
                    <DialogDescription>
                      {isAdmin ? tooltipTextAdmin[step.status] : tooltipTextUser[step.status]}
                    </DialogDescription>
                  </DialogHeader>

                  {/* Histórico */}
                  {stepHistory.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <h4 className="font-semibold">Histórico</h4>
                      <div className="space-y-2">
                        {stepHistory.map((h) => (
                          <div key={h.id} className="p-2 border rounded">
                            <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                            <p className="text-sm font-medium">{h.step_status.replace("_", " ")}</p>
                            {h.observations && (
                              <p className="text-sm mt-1">{h.observations}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Anexos relevantes */}
                  {attachmentsCount > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="font-semibold">Anexos desta etapa</h4>
                      <div className="space-y-2">
                        {stepAttachments.map((doc) => (
                          <div key={doc.id} className="p-2 border rounded flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {doc.document_type === "certificado_final" ? (
                                <FileText className="w-4 h-4" />
                              ) : (
                                doc.document_type.match(/png|jpg|jpeg|gif/) ? (
                                  <ImageIcon className="w-4 h-4" />
                                ) : (
                                  <FileIcon className="w-4 h-4" />
                                )
                              )}
                              <div>
                                <p className="text-sm font-medium">{doc.document_name}</p>
                                <p className="text-xs text-muted-foreground">{formatStepStatus(doc.status)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {onPreviewDoc && (
                                <Button variant="outline" size="sm" onClick={() => onPreviewDoc(doc)}>
                                  <Eye className="w-4 h-4 mr-1" /> Ver
                                </Button>
                              )}
                              {onDownloadDoc && (
                                <Button variant="outline" size="sm" onClick={() => onDownloadDoc(doc)}>
                                  <Download className="w-4 h-4 mr-1" /> Baixar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            ) : (
              <div key={step.status} className="cursor-default">
                {StepNode}
              </div>
            );

            return (
              <div key={step.status} className="flex-1 flex items-center">
                {NodeWithDialog}

                {index < timelineSteps.length - 1 && (
                  <div className="h-[3px] flex-1 bg-gray-300 mx-2 relative">
                    <div
                      className={cn(
                        "absolute left-0 top-0 bottom-0 transition-all duration-300",
                        index < resolvedActiveIndex && "bg-green-600",
                        index === resolvedActiveIndex && "bg-red-600",
                        index > resolvedActiveIndex && "bg-gray-300",
                      )}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

// Tooltips informativos (texto)
const tooltipTextUser: Record<ProcessStatus, string> = {
  cadastro: "Etapa inicial: dados enviados e aguardando pagamento.",
  triagem: "Análise documental e técnica preliminar.",
  vistoria: "Agendamento e realização da vistoria in loco.",
  comissao: "Alocação da viabilidade e distribuição técnica.",
  aprovacao: "Emissão e liberação do AVCB.",
  concluido: "Processo finalizado / emitido. Documento disponível.",
  exigencia: "Há exigências pendentes para correção.",
};

const tooltipTextAdmin: Record<ProcessStatus, string> = {
  cadastro: "Processo criado. Aguardando pagamento (Entrada).",
  triagem: "Verifique documentos e dados na triagem.",
  vistoria: "Executar análise técnica/campo e vistoria.",
  comissao: "Distribuir viabilidade e encaminhar equipe.",
  aprovacao: "Emitir e homologar o documento final (AVCB).",
  concluido: "Processo finalizado / emitido para o usuário.",
  exigencia: "Processo em exigência. Aguardando usuário.",
};
