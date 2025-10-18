export type RiskKey = "II" | "III" | "IV";
export type OcupacaoKey = "default" | "comercial" | "industrial" | "evento_temporario";

export interface DocDef { id: string; nome: string }
export interface DocsSet { obrigatorios: DocDef[]; opcionais: DocDef[] }

export const DocumentosPorOcupacao: Record<OcupacaoKey, Record<RiskKey, DocsSet>> = {
  default: {
    II: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-baixa", nome: "Planta Baixa" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
    III: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-baixa", nome: "Planta Baixa" },
        { id: "memorial-descritivo", nome: "Memorial Descritivo" },
        { id: "art-rrt", nome: "ART / RRT" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
    IV: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-baixa", nome: "Planta Baixa" },
        { id: "memorial-descritivo", nome: "Memorial Descritivo" },
        { id: "art-rrt", nome: "ART / RRT" },
        { id: "relatorio-seguranca", nome: "Relatório de Segurança" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
  },
  comercial: {
    II: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-layout", nome: "Planta de Layout (rotas e saídas)" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "relatorio-fotos", nome: "Relatório fotográfico" },
      ],
    },
    III: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-layout", nome: "Planta de Layout (rotas e saídas)" },
        { id: "memorial-seguranca", nome: "Memorial de Segurança Contra Incêndio" },
        { id: "art-rrt", nome: "ART / RRT do responsável técnico" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "relatorio-fotos", nome: "Relatório fotográfico" },
      ],
    },
    IV: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-layout", nome: "Planta de Layout (rotas e saídas)" },
        { id: "memorial-seguranca", nome: "Memorial de Segurança Contra Incêndio" },
        { id: "art-rrt", nome: "ART / RRT do responsável técnico" },
        { id: "relatorio-seguranca", nome: "Relatório de Segurança" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "relatorio-fotos", nome: "Relatório fotográfico" },
      ],
    },
  },
  industrial: {
    II: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-processo", nome: "Planta de Processo e Riscos" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
    III: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-processo", nome: "Planta de Processo e Riscos" },
        { id: "memorial-processo", nome: "Memorial de Segurança de Processo" },
        { id: "art-rrt", nome: "ART / RRT de instalação" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
    IV: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-processo", nome: "Planta de Processo e Riscos" },
        { id: "memorial-processo", nome: "Memorial de Segurança de Processo" },
        { id: "art-rrt", nome: "ART / RRT de instalação" },
        { id: "relatorio-processo", nome: "Relatório de Segurança de Processo" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
      ],
    },
  },
  evento_temporario: {
    II: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-evento", nome: "Planta de Layout do Evento" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "plano-evento", nome: "Plano de Segurança do Evento" },
      ],
    },
    III: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-evento", nome: "Planta de Layout do Evento" },
        { id: "memorial-evento", nome: "Memorial de Segurança do Evento" },
        { id: "art-rrt", nome: "ART / RRT do evento" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "plano-evento", nome: "Plano de Segurança do Evento" },
        { id: "relatorio-fotos", nome: "Relatório fotográfico" },
      ],
    },
    IV: {
      obrigatorios: [
        { id: "req-avcb", nome: "Requerimento de Solicitação AVCB" },
        { id: "planta-evento", nome: "Planta de Layout do Evento" },
        { id: "memorial-evento", nome: "Memorial de Segurança do Evento" },
        { id: "art-rrt", nome: "ART / RRT do evento" },
        { id: "relatorio-seguranca", nome: "Relatório de Segurança do Evento" },
      ],
      opcionais: [
        { id: "comp-pagamento", nome: "Comprovante de pagamento da taxa" },
        { id: "plano-evento", nome: "Plano de Segurança do Evento" },
        { id: "relatorio-fotos", nome: "Relatório fotográfico" },
      ],
    },
  },
};