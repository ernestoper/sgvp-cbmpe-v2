import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus, SearchCheck, ClipboardList, Users, CheckCircle, Award, AlertCircle, Paperclip, Image as ImageIcon, FileText, File as FileIcon, Eye, Download } from "lucide-react";
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
  { status: "cadastro", label: "Cadastro", icon: FilePlus },
  { status: "triagem", label: "Triagem", icon: SearchCheck },
  { status: "vistoria", label: "Vistoria", icon: ClipboardList },
  { status: "comissao", label: "Comissão", icon: Users },
  { status: "aprovacao", label: "Aprovação Final", icon: CheckCircle },
  { status: "concluido", label: "Concluído", icon: Award },
];

export const ProcessTimeline = ({ currentStatus, history = [], className, mode = "user", attachments = [], onPreviewDoc, onDownloadDoc, onSelectStage }: ProcessTimelineProps) => {
  const stageStatuses = timelineSteps.map(s => s.status);

  // Quando estiver em exigência, usamos a última etapa registrada no histórico como etapa ativa
  const lastStageInHistory = [...history].reverse().find(h => stageStatuses.includes(h.status as ProcessStatus));
  const activeStage: ProcessStatus = currentStatus === "exigencia" ? (lastStageInHistory?.status as ProcessStatus) || "triagem" : currentStatus;
  const activeIndex = timelineSteps.findIndex((step) => step.status === activeStage);
  const hasExigencia = currentStatus === "exigencia";

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
    // Para a etapa concluído: mostrar certificado final e quaisquer anexos marcados com stage 'concluido'
    if (status === "concluido") {
      return attachments.filter((doc) => {
        const isFinalCert = doc.document_type === "certificado_final" && doc.status === "completed" && (mode === "admin" || !!doc.disponivel_usuario);
        const isMarkedConcluded = (doc.stage || "") === "concluido";
        return isFinalCert || isMarkedConcluded;
      });
    }
    // Demais etapas: por ora não exibir anexos (reduz ruído)
    return [] as AttachedDoc[];
  };

  const getStepStatus = (index: number) => {
    const step = timelineSteps[index].status;
    if (hasExigencia && index === activeIndex) {
      return "exigencia";
    }
    if (step === activeStage) return "in_progress";
    if (isStageApproved(step)) return "completed";
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
      <div className={cn("relative pb-4 -mb-2", isAdmin ? "overflow-x-hidden" : "overflow-x-auto snap-x snap-mandatory scroll-smooth")}>
        <div className={cn("flex items-center px-2", isAdmin ? "gap-4" : "gap-8", !isAdmin && "min-w-max")}>
          {timelineSteps.map((step, index) => {
            const Icon = step.icon;
            const stepStatus = getStepStatus(index);
            const isCompleted = stepStatus === "completed";
            const isCurrent = stepStatus === "in_progress";
            const isExigencia = stepStatus === "exigencia" && index === activeIndex;
            const stepHistory = getStepHistory(step.status);
            const tooltipText = mode === "admin" ? tooltipTextAdmin[step.status] : tooltipTextUser[step.status];

            const stepAttachments = getStepAttachments(step.status);
            const attachmentsCount = stepAttachments.length;
            const StepContent = (
              <div className={cn("relative flex flex-col items-center snap-start", isAdmin ? "min-w-[72px] sm:min-w-[90px] md:min-w-[100px] lg:min-w-[120px]" : "min-w-[120px]")}> 
                {/* Conector à esquerda (não no primeiro) */}
                {index > 0 && (
                  <div
                    className={cn(
                      "absolute top-8 h-1",
                      isAdmin ? "left-[-3rem] w-12 sm:left-[-3.5rem] sm:w-14 md:left-[-4rem] md:w-20" : "left-[-4rem] w-16 md:w-24",
                      isCompleted ? "bg-green-600" : "bg-muted"
                    )}
                  />
                )}

                {/* Ícone circular */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full transition-all duration-300 border-2",
                    isCompleted && "bg-green-600 text-white border-green-600",
                    isCurrent && !isExigencia && "bg-yellow-500 text-black border-yellow-500 ring-4 ring-yellow-500/30 scale-105",
                    isExigencia && "bg-red-600 text-white border-red-600 ring-4 ring-red-600/20",
                    !isCompleted && !isCurrent && !isExigencia && "bg-muted text-muted-foreground border-muted-foreground/20",
                    isCurrent ? (isAdmin ? "w-14 h-14 md:w-16 md:h-16" : "w-16 h-16") : (isAdmin ? "w-12 h-12 md:w-14 md:h-14" : "w-14 h-14")
                  )}
                >
                  {isExigencia ? <AlertCircle className={cn(isCurrent ? (isAdmin ? "w-7 h-7 md:w-8 md:h-8" : "w-8 h-8") : (isAdmin ? "w-6 h-6 md:w-7 md:h-7" : "w-7 h-7"))}/> : <Icon className={cn(isCurrent ? (isAdmin ? "w-7 h-7 md:w-8 md:h-8" : "w-8 h-8") : (isAdmin ? "w-6 h-6 md:w-7 md:h-7" : "w-7 h-7"))} />}
                </div>

                {/* Título e meta */}
                <div className="mt-2 text-center">
                  <h4
                    className={cn(
                      "font-semibold text-sm",
                      (isCompleted || isCurrent || isExigencia) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </h4>
                  <p className={cn(
                    "text-[12px] mt-1",
                    isExigencia ? "text-red-600 font-medium" : "text-muted-foreground"
                  )}>
                    {isExigencia && "Exigência"}
                    {isCurrent && !isExigencia && "Em andamento"}
                    {isCompleted && "Concluído"}
                    {!isCompleted && !isCurrent && !isExigencia && "Pendente"}
                  </p>

                  {attachmentsCount > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center">
                      <Paperclip className="w-3 h-3 mr-1" /> {attachmentsCount} anexo(s)
                    </p>
                  )}
                </div>

                {/* Conector à direita (não no último) */}
                {index < timelineSteps.length - 1 && (
                  <div
                    className={cn(
                      "absolute right-[-4rem] top-8 h-1 w-16 md:w-24",
                      // segment fica verde se esta etapa estiver concluída
                      isCompleted ? "bg-green-600" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );

            // Se houver histórico ou anexos da etapa, torna clicável para abrir o diálogo
            if (stepHistory.length > 0 || attachmentsCount > 0) {
              return (
                <Dialog key={step.status}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <div className="cursor-pointer hover:opacity-90 transition" onClick={() => onSelectStage?.(step.status)}>
                            {StepContent}
                          </div>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{step.label}</DialogTitle>
                      <DialogDescription>Detalhes desta etapa</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {stepHistory.map((h) => (
                        <div key={h.id} className="border-l-2 border-primary pl-4 py-2">
                          <p className="text-sm font-medium">
                            {new Date(h.created_at).toLocaleDateString("pt-BR")} às {new Date(h.created_at).toLocaleTimeString("pt-BR")}
                          </p>
                          {h.responsible_name && (
                            <p className="text-sm text-muted-foreground">
                              Responsável: {h.responsible_name}
                            </p>
                          )}
                          <p className="text-sm mt-2">
                            Status: <span className="font-medium">{formatStepStatus(h.step_status)}</span>
                          </p>
                          {h.observations && (
                            <div className="mt-2 p-2 bg-muted rounded text-sm">
                              {h.observations}
                            </div>
                          )}
                        </div>
                      ))}
                      {attachmentsCount > 0 && (
                        <div className="pt-2">
                          <h4 className="text-sm font-semibold mb-2 flex items-center"><Paperclip className="w-4 h-4 mr-1" /> Anexos desta etapa</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {stepAttachments.map((doc) => (
                              <div key={doc.id} className="border rounded p-2">
                                <div className="aspect-video bg-muted rounded flex items-center justify-center overflow-hidden">
                                  {doc.document_type === "imagem" || doc.file_url.match(/\.(png|jpe?g)$/i) ? (
                                    <Button variant="ghost" size="icon" onClick={() => onPreviewDoc && onPreviewDoc(doc)}>
                                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                    </Button>
                                  ) : (doc.document_type === "pdf" || doc.file_url.endsWith(".pdf")) ? (
                                    <Button variant="ghost" size="icon" onClick={() => onPreviewDoc && onPreviewDoc(doc)}>
                                      <FileText className="w-8 h-8 text-muted-foreground" />
                                    </Button>
                                  ) : (
                                    <FileIcon className="w-8 h-8 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="mt-2">
                                  <p className="text-xs font-medium truncate">{doc.document_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{doc.status}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    {onPreviewDoc && (
                                      <Button variant="ghost" size="sm" onClick={() => onPreviewDoc(doc)}>
                                        <Eye className="w-3 h-3 mr-1" /> Ver
                                      </Button>
                                    )}
                                    {onDownloadDoc && (
                                      <Button variant="ghost" size="sm" onClick={() => onDownloadDoc(doc)}>
                                        <Download className="w-3 h-3 mr-1" /> Baixar
                                      </Button>
                                    )}
                                  </div>
                                  {doc.carimbado_por && (
                                    <p className="text-[11px] text-muted-foreground mt-1">Carimbado por: {doc.carimbado_por}</p>
                                  )}
                                  {doc.data_carimbo && (
                                    <p className="text-[11px] text-muted-foreground">Liberado em: {new Date(doc.data_carimbo).toLocaleString("pt-BR")}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              );
            }

            return (
              <TooltipProvider key={step.status}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div onClick={() => onSelectStage?.(step.status)}>
                      {StepContent}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{tooltipText}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
