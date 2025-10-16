-- Migration para garantir configuração correta e forçar regeneração de tipos

-- Adicionar comentários nas tabelas para documentação
COMMENT ON TABLE public.profiles IS 'Armazena informações do perfil dos usuários';
COMMENT ON TABLE public.user_roles IS 'Armazena as funções (roles) dos usuários de forma segura';
COMMENT ON TABLE public.processes IS 'Armazena os processos de vistoria do CBM-PE';
COMMENT ON TABLE public.process_history IS 'Histórico de mudanças de status dos processos';
COMMENT ON TABLE public.process_documents IS 'Documentos anexados aos processos';

-- Verificar se as políticas RLS estão ativas
DO $$ 
BEGIN
  -- Garantir que RLS está habilitado em todas as tabelas
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.process_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.process_documents ENABLE ROW LEVEL SECURITY;
END $$;

-- Adicionar política para permitir que usuários insiram em process_history ao criar processos
-- (necessário para o fluxo de criação de processos)
DROP POLICY IF EXISTS "Users can create history for their processes" ON public.process_history;
CREATE POLICY "Users can create history for their processes"
  ON public.process_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = process_history.process_id
      AND processes.user_id = auth.uid()
    )
  );