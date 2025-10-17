// Integração com DynamoDB via Netlify Functions
// Substitui o Supabase

// Usar analyses como function universal
const API_BASE = '/.netlify/functions/analyses';

export interface Process {
  id: string;
  user_id: string;
  process_number: string;
  company_name: string;
  cnpj: string;
  address: string;
  cnae_principal?: string;
  cnaes_secundarios?: string[];
  current_status: 'cadastro' | 'triagem' | 'vistoria' | 'comissao' | 'aprovacao' | 'concluido' | 'exigencia';
  created_at: string;
  updated_at: string;
}

export interface ProcessHistory {
  id: string;
  process_id: string;
  status: string;
  step_status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'resubmitted';
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
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'resubmitted';
  rejection_reason: string | null;
  uploaded_at: string;
  updated_at: string;
  stage?: string;
  disponivel_usuario?: boolean;
  carimbado_por?: string | null;
  data_carimbo?: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  cnpj: string | null;
  company_name: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

// API Client
export const dynamodb = {
  // Processos
  processes: {
    getAll: async (): Promise<Process[]> => {
      console.log('Fetching processes from:', `${API_BASE}?table=processes`);
      const response = await fetch(`${API_BASE}?table=processes`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Erro ao buscar processos: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Processes fetched:', data.length);
      return data;
    },

    getById: async (id: string): Promise<Process> => {
      const response = await fetch(`${API_BASE}?table=processes&id=${id}`);
      if (!response.ok) throw new Error('Processo não encontrado');
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    },

    getByUserId: async (userId: string): Promise<Process[]> => {
      const response = await fetch(`${API_BASE}?table=processes&user_id=${userId}`);
      if (!response.ok) throw new Error('Erro ao buscar processos');
      return response.json();
    },

    create: async (process: Omit<Process, 'id' | 'created_at' | 'updated_at'>): Promise<{ id: string }> => {
      const response = await fetch(`${API_BASE}?table=processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(process),
      });
      if (!response.ok) throw new Error('Erro ao criar processo');
      return response.json();
    },

    update: async (id: string, data: Partial<Process>): Promise<void> => {
      const response = await fetch(`${API_BASE}?table=processes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar processo');
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}?table=processes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Erro ao deletar processo');
    },
  },

  // Histórico
  history: {
    getByProcessId: async (processId: string): Promise<ProcessHistory[]> => {
      const response = await fetch(`${API_BASE}?table=process_history&process_id=${processId}`);
      if (!response.ok) throw new Error('Erro ao buscar histórico');
      return response.json();
    },

    create: async (history: Omit<ProcessHistory, 'id' | 'created_at'>): Promise<{ id: string }> => {
      const response = await fetch(`${API_BASE}?table=process_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(history),
      });
      if (!response.ok) throw new Error('Erro ao criar histórico');
      return response.json();
    },
  },

  // Documentos
  documents: {
    getByProcessId: async (processId: string): Promise<ProcessDocument[]> => {
      const response = await fetch(`${API_BASE}?table=process_documents&process_id=${processId}`);
      if (!response.ok) throw new Error('Erro ao buscar documentos');
      return response.json();
    },

    create: async (document: Omit<ProcessDocument, 'id' | 'uploaded_at' | 'updated_at'>): Promise<{ id: string }> => {
      const response = await fetch(`${API_BASE}?table=process_documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      });
      if (!response.ok) throw new Error('Erro ao criar documento');
      return response.json();
    },

    update: async (id: string, data: Partial<ProcessDocument>): Promise<void> => {
      const response = await fetch(`${API_BASE}?table=process_documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar documento');
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}?table=process_documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Erro ao deletar documento');
    },
  },

  // Perfis
  profiles: {
    getById: async (id: string): Promise<Profile> => {
      const response = await fetch(`${API_BASE}?table=profiles&id=${id}`);
      if (!response.ok) throw new Error('Perfil não encontrado');
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    },

    create: async (profile: Omit<Profile, 'id' | 'created_at'>): Promise<{ id: string }> => {
      const response = await fetch(`${API_BASE}?table=profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw new Error('Erro ao criar perfil');
      return response.json();
    },

    update: async (id: string, data: Partial<Profile>): Promise<void> => {
      const response = await fetch(`${API_BASE}?table=profiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
      });
      if (!response.ok) throw new Error('Erro ao atualizar perfil');
    },
  },

  // Roles
  roles: {
    getByUserId: async (userId: string): Promise<UserRole | null> => {
      const response = await fetch(`${API_BASE}?table=user_roles&user_id=${userId}`);
      if (!response.ok) return null;
      const roles = await response.json();
      return roles[0] || null;
    },

    create: async (role: Omit<UserRole, 'id' | 'created_at'>): Promise<{ id: string }> => {
      const response = await fetch(`${API_BASE}?table=user_roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role),
      });
      if (!response.ok) throw new Error('Erro ao criar role');
      return response.json();
    },
  },
};
