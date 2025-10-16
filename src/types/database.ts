// Tipos temporários do banco de dados - EXTENDENDO SUPABASE TYPES
// Este arquivo complementa src/integrations/supabase/types.ts

import type { Database } from '@/integrations/supabase/types';

// Enums do banco
export type ProcessStatus = 
  | 'cadastro'
  | 'triagem'
  | 'vistoria'
  | 'comissao'
  | 'aprovacao'
  | 'concluido'
  | 'exigencia';

export type StepStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'resubmitted';

export type UserRole = 'admin' | 'user';

// Interfaces das tabelas
export interface Profile {
  id: string;
  full_name: string;
  cnpj: string | null;
  company_name: string | null;
  created_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Process {
  id: string;
  user_id: string;
  process_number: string;
  company_name: string;
  cnpj: string;
  address: string;
  current_status: ProcessStatus;
  created_at: string;
  updated_at: string;
}

export interface ProcessHistory {
  id: string;
  process_id: string;
  status: ProcessStatus;
  step_status: StepStatus;
  observations: string | null;
  responsible_id: string | null;
  responsible_name: string | null;
  created_at: string;
}

export interface ProcessDocument {
  id: string;
  process_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  status: StepStatus;
  rejection_reason: string | null;
  uploaded_at: string;
  updated_at: string;
  disponivel_usuario?: boolean;
  carimbado_por?: string | null;
  data_carimbo?: string | null;
}

// Helper types para Supabase client - CRUCIAL PARA RESOLVER OS ERROS
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    from<T extends keyof TablesMap>(
      table: T
    ): any;
  }
}

type TablesMap = {
  'processes': Process;
  'process_history': ProcessHistory;
  'process_documents': ProcessDocument;
  'profiles': Profile;
  'user_roles': UserRoleRecord;
}
