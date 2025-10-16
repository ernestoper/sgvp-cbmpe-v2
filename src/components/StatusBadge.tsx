import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  FilePlus,
  SearchCheck,
  ClipboardList,
  Users,
  CheckCircle,
  Award,
  Package,
  RefreshCw
} from "lucide-react";

type ProcessStatus = 
  | "cadastro" 
  | "triagem" 
  | "vistoria" 
  | "comissao" 
  | "aprovacao" 
  | "concluido" 
  | "exigencia";

type StepStatus = "pending" | "in_progress" | "completed" | "rejected" | "resubmitted";

interface StatusBadgeProps {
  status: ProcessStatus | StepStatus;
  type?: "process" | "step";
}

const processStatusConfig = {
  cadastro: {
    label: "Cadastro",
    icon: FilePlus,
    variant: "secondary" as const,
  },
  triagem: {
    label: "Triagem",
    icon: SearchCheck,
    variant: "default" as const,
  },
  vistoria: {
    label: "Vistoria",
    icon: ClipboardList,
    variant: "default" as const,
  },
  comissao: {
    label: "Comissão",
    icon: Users,
    variant: "default" as const,
  },
  aprovacao: {
    label: "Aprovação Final",
    icon: CheckCircle,
    variant: "default" as const,
  },
  concluido: {
    label: "Concluído",
    icon: Award,
    variant: "default" as const,
  },
  exigencia: {
    label: "Em Exigência",
    icon: AlertCircle,
    variant: "destructive" as const,
  },
};

const stepStatusConfig = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-secondary text-secondary-foreground",
  },
  in_progress: {
    label: "Em Andamento",
    icon: Package,
    className: "bg-warning text-warning-foreground",
  },
  completed: {
    label: "Concluído",
    icon: CheckCircle2,
    className: "bg-success text-success-foreground",
  },
  rejected: {
    label: "Reprovado",
    icon: XCircle,
    className: "bg-destructive text-destructive-foreground",
  },
  resubmitted: {
    label: "Corrigido / Reenviado",
    icon: RefreshCw,
    className: "bg-primary/80 text-primary-foreground",
  },
};

export const StatusBadge = ({ status, type = "process" }: StatusBadgeProps) => {
  if (type === "step") {
    const config = stepStatusConfig[status as StepStatus];
    
    // Handle undefined config gracefully
    if (!config) {
      console.warn(`Unknown step status: ${status}`);
      return (
        <Badge className="bg-muted text-muted-foreground">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status || "Desconhecido"}
        </Badge>
      );
    }
    
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  }

  const config = processStatusConfig[status as ProcessStatus];
  
  // Handle undefined config gracefully
  if (!config) {
    console.warn(`Unknown process status: ${status}`);
    return (
      <Badge variant="secondary">
        <AlertCircle className="w-3 h-3 mr-1" />
        {status || "Desconhecido"}
      </Badge>
    );
  }
  
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};
