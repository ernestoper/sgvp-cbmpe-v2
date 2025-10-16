// MIGRADO PARA DYNAMODB - Mock do Supabase para compatibilidade
import { dynamodb } from '@/lib/dynamodb';

// Mock simples de autenticação (localStorage)
const AUTH_KEY = 'avcb_auth_user';

const mockAuth = {
  getSession: async () => {
    const user = localStorage.getItem(AUTH_KEY);
    if (user) {
      return { data: { session: { user: JSON.parse(user) } }, error: null };
    }
    return { data: { session: null }, error: null };
  },
  
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    console.log('🔐 Mock signInWithPassword:', { email, passwordLength: password.length });
    
    // Primeiro verificar usuários hardcoded
    const mockUsers = [
      { id: 'admin-1', email: 'admin@cbm.pe.gov.br', password: 'Admin@CBM2025', full_name: 'Administrador CBMPE', role: 'admin' },
      { id: 'user-1', email: 'usuario@empresa.com', password: 'user123', full_name: 'Usuário Empresa', role: 'user' },
    ];
    
    const hardcodedUser = mockUsers.find(u => u.email === email && u.password === password);
    
    if (hardcodedUser) {
      console.log('✅ Usuário hardcoded encontrado:', hardcodedUser.email);
      const userData = { id: hardcodedUser.id, email: hardcodedUser.email, full_name: hardcodedUser.full_name };
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
      localStorage.setItem(`${AUTH_KEY}_role`, hardcodedUser.role);
      
      return { data: { user: userData }, error: null };
    }
    
    // Verificar usuários cadastrados dinamicamente
    const registeredUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
    console.log('🔍 Verificando usuários registrados:', registeredUsers.length);
    
    const registeredUser = registeredUsers.find((u: any) => u.email === email && u.password === password);
    
    if (registeredUser) {
      console.log('✅ Usuário registrado encontrado:', registeredUser.email);
      const userData = { id: registeredUser.id, email: registeredUser.email, full_name: registeredUser.full_name };
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
      localStorage.setItem(`${AUTH_KEY}_role`, 'user');
      
      return { data: { user: userData }, error: null };
    }
    
    console.log('❌ Credenciais inválidas para:', email);
    return { data: { user: null }, error: { message: 'Credenciais inválidas' } };
  },
  
  signUp: async ({ email, password, options }: any) => {
    console.log('📝 Mock signUp:', { email, options: options?.data });
    
    const userId = `user-${Date.now()}`;
    const userData = { 
      id: userId, 
      email, 
      full_name: options?.data?.full_name || email,
      user_metadata: options?.data
    };
    
    try {
      // Salvar usuário na lista de usuários registrados
      const registeredUsers = JSON.parse(localStorage.getItem('registered_users') || '[]');
      registeredUsers.push({
        id: userId,
        email,
        password, // Em produção, isso seria hasheado
        full_name: userData.full_name,
        cnpj: options?.data?.cnpj,
        company_name: options?.data?.company_name
      });
      localStorage.setItem('registered_users', JSON.stringify(registeredUsers));
      
      // Criar perfil no DynamoDB
      console.log('🏗️ Criando perfil no DynamoDB...');
      await dynamodb.profiles.create({
        id: userId,
        full_name: userData.full_name,
        cnpj: options?.data?.cnpj || null,
        company_name: options?.data?.company_name || null,
      });
      
      // Criar role no DynamoDB
      console.log('🏗️ Criando role no DynamoDB...');
      await dynamodb.roles.create({
        user_id: userId,
        role: 'user',
      });
      
      console.log('✅ Usuário criado com sucesso:', userId);
      return { data: { user: userData }, error: null };
      
    } catch (error: any) {
      console.error('❌ Erro ao criar usuário:', error);
      return { data: { user: null }, error: { message: error.message } };
    }
  },
  
  signOut: async () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(`${AUTH_KEY}_role`);
    return { error: null };
  },
  
  getUser: async () => {
    const user = localStorage.getItem(AUTH_KEY);
    if (user) {
      return { data: { user: JSON.parse(user) }, error: null };
    }
    return { data: { user: null }, error: null };
  },
  
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    // Mock - retorna subscription
    const checkAuth = () => {
      const user = localStorage.getItem(AUTH_KEY);
      if (user) {
        callback('SIGNED_IN', { user: JSON.parse(user) });
      } else {
        callback('SIGNED_OUT', null);
      }
    };
    
    // Verificar estado inicial
    checkAuth();
    
    // Retornar objeto de subscription
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  },
};

// Mock do cliente Supabase usando DynamoDB
export const supabase = {
  auth: mockAuth,
  
  // Mock do Realtime - não faz nada mas evita erros
  channel: (name: string) => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  
  // Mock do Storage - retorna URLs diretas do S3
  storage: {
    from: (bucket: string) => ({
      getPublicUrl: (path: string) => ({
        data: { publicUrl: path }, // O path já é a URL completa do S3
      }),
      createSignedUrl: async (path: string, expiresIn: number) => {
        // Como o bucket é público, retornar a URL direta
        // Se precisar de URLs assinadas, usar storage.getSignedUrl()
        return { data: { signedUrl: path }, error: null };
      },
      download: async (path: string) => {
        try {
          const response = await fetch(path);
          const blob = await response.blob();
          return { data: blob, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error.message } };
        }
      },
      upload: async (path: string, file: File) => {
        // Upload já é feito pelo storage.ts
        return { data: { path }, error: null };
      },
    }),
  },
  
  from: (table: string) => ({
    select: (columns?: string) => ({
      order: (column: string, options?: any) => ({
        async then(resolve: any) {
          try {
            let data: any[] = [];
            
            if (table === 'processes') {
              data = await dynamodb.processes.getAll();
              // Ordenar por created_at
              data.sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return options?.ascending ? dateA - dateB : dateB - dateA;
              });
            }
            
            resolve({ data, error: null });
          } catch (error: any) {
            console.error('Error fetching data:', error);
            resolve({ data: [], error: { message: error.message } });
          }
        },
      }),
      
      in: (column: string, values: any[]) => ({
        order: (orderColumn: string, options?: any) => ({
          async then(resolve: any) {
            try {
              // Por enquanto, retornar array vazio para versões de documentos
              // TODO: Implementar tabela de versões se necessário
              resolve({ data: [], error: null });
            } catch (error: any) {
              resolve({ data: [], error: { message: error.message } });
            }
          },
        }),
        
        async then(resolve: any) {
          try {
            // Por enquanto, retornar array vazio
            resolve({ data: [], error: null });
          } catch (error: any) {
            resolve({ data: [], error: { message: error.message } });
          }
        },
      }),
      
      eq: (column: string, value: any) => ({
        order: (orderColumn: string, options?: any) => ({
          async then(resolve: any) {
            try {
              let data: any[] = [];
              
              if (table === 'process_history') {
                data = await dynamodb.history.getByProcessId(value);
              } else if (table === 'process_documents') {
                data = await dynamodb.documents.getByProcessId(value);
              } else if (table === 'processes') {
                if (column === 'user_id') {
                  data = await dynamodb.processes.getByUserId(value);
                } else {
                  data = await dynamodb.processes.getAll();
                }
              }
              
              // Ordenar
              if (data.length > 0 && orderColumn) {
                data.sort((a, b) => {
                  const valA = a[orderColumn];
                  const valB = b[orderColumn];
                  
                  // Tentar converter para data se parecer uma data
                  const dateA = new Date(valA).getTime();
                  const dateB = new Date(valB).getTime();
                  
                  if (!isNaN(dateA) && !isNaN(dateB)) {
                    return options?.ascending ? dateA - dateB : dateB - dateA;
                  }
                  
                  // Ordenação numérica ou string
                  if (typeof valA === 'number' && typeof valB === 'number') {
                    return options?.ascending ? valA - valB : valB - valA;
                  }
                  
                  return options?.ascending 
                    ? String(valA).localeCompare(String(valB))
                    : String(valB).localeCompare(String(valA));
                });
              }
              
              resolve({ data, error: null });
            } catch (error: any) {
              console.error('Error fetching data:', error);
              resolve({ data: [], error: { message: error.message } });
            }
          },
        }),
        
        eq: (column2?: string, value2?: any) => ({
          maybeSingle: async () => {
            try {
              if (table === 'user_roles') {
                // Buscar role do usuário
                const role = localStorage.getItem(`${AUTH_KEY}_role`);
                if (role && column2 === 'role' && role === value2) {
                  return { data: { user_id: value, role }, error: null };
                }
                return { data: null, error: null };
              }
              return { data: null, error: null };
            } catch (error: any) {
              return { data: null, error: { message: error.message } };
            }
          },
        }),
        
        maybeSingle: async () => {
          try {
            if (table === 'user_roles') {
              // Buscar role do usuário
              const role = localStorage.getItem(`${AUTH_KEY}_role`);
              if (role) {
                return { data: { user_id: value, role }, error: null };
              }
              return { data: null, error: null };
            }
            if (table === 'profiles') {
              const data = await dynamodb.profiles.getById(value);
              return { data, error: null };
            }
            return { data: null, error: null };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        },
        
        single: async () => {
          try {
            if (table === 'profiles') {
              const data = await dynamodb.profiles.getById(value);
              return { data, error: null };
            }
            if (table === 'user_roles') {
              const role = localStorage.getItem(`${AUTH_KEY}_role`);
              if (role) {
                return { data: { user_id: value, role }, error: null };
              }
              return { data: null, error: { message: 'Role not found' } };
            }
            if (table === 'processes') {
              const data = await dynamodb.processes.getById(value);
              return { data, error: null };
            }
            return { data: null, error: { message: 'Not found' } };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        },
        
        async then(resolve: any) {
          try {
            let data: any[] = [];
            
            if (table === 'processes') {
              if (column === 'user_id') {
                data = await dynamodb.processes.getByUserId(value);
              } else {
                data = await dynamodb.processes.getAll();
              }
            } else if (table === 'process_history') {
              data = await dynamodb.history.getByProcessId(value);
            } else if (table === 'process_documents') {
              data = await dynamodb.documents.getByProcessId(value);
            }
            
            resolve({ data, error: null });
          } catch (error: any) {
            resolve({ data: null, error: { message: error.message } });
          }
        },
      }),
      
      async then(resolve: any) {
        try {
          let data: any[] = [];
          
          if (table === 'processes') {
            data = await dynamodb.processes.getAll();
          }
          
          resolve({ data, error: null });
        } catch (error: any) {
          resolve({ data: null, error: { message: error.message } });
        }
      },
    }),
    
    insert: (values: any) => ({
      select: () => ({
        single: async () => {
          try {
            let result;
            
            if (table === 'processes') {
              result = await dynamodb.processes.create(values);
            } else if (table === 'process_history') {
              result = await dynamodb.history.create(values);
            } else if (table === 'process_documents') {
              result = await dynamodb.documents.create(values);
            } else if (table === 'profiles') {
              result = await dynamodb.profiles.create(values);
            } else if (table === 'user_roles') {
              result = await dynamodb.roles.create(values);
            }
            
            return { data: { ...values, id: result?.id }, error: null };
          } catch (error: any) {
            return { data: null, error: { message: error.message } };
          }
        },
      }),
      
      // Suporte para insert sem .select()
      async then(resolve: any) {
        try {
          let result;
          
          if (table === 'processes') {
            result = await dynamodb.processes.create(values);
          } else if (table === 'process_history') {
            result = await dynamodb.history.create(values);
          } else if (table === 'process_documents') {
            result = await dynamodb.documents.create(values);
          } else if (table === 'profiles') {
            result = await dynamodb.profiles.create(values);
          } else if (table === 'user_roles') {
            result = await dynamodb.roles.create(values);
          }
          
          resolve({ data: { ...values, id: result?.id }, error: null });
        } catch (error: any) {
          resolve({ data: null, error: { message: error.message } });
        }
      },
    }),
    
    update: (values: any) => ({
      eq: (column: string, value: any) => ({
        eq: (column2: string, value2: any) => ({
          select: () => ({
            single: async () => {
              try {
                // Para múltiplos eq, usar o primeiro como ID
                if (table === 'processes') {
                  await dynamodb.processes.update(value, values);
                } else if (table === 'process_documents') {
                  await dynamodb.documents.update(value, values);
                } else if (table === 'profiles') {
                  await dynamodb.profiles.update(value, values);
                }
                
                return { data: { ...values, [column]: value }, error: null };
              } catch (error: any) {
                return { data: null, error: { message: error.message } };
              }
            },
          }),
        }),
        
        select: () => ({
          single: async () => {
            try {
              if (table === 'processes') {
                await dynamodb.processes.update(value, values);
              } else if (table === 'process_documents') {
                await dynamodb.documents.update(value, values);
              } else if (table === 'profiles') {
                await dynamodb.profiles.update(value, values);
              }
              
              return { data: { ...values, [column]: value }, error: null };
            } catch (error: any) {
              return { data: null, error: { message: error.message } };
            }
          },
        }),
        
        // Suporte para update sem .select()
        async then(resolve: any) {
          try {
            console.log('🔄 Update called:', { table, column, value, values });
            
            if (table === 'processes') {
              await dynamodb.processes.update(value, values);
            } else if (table === 'process_documents') {
              await dynamodb.documents.update(value, values);
            } else if (table === 'profiles') {
              await dynamodb.profiles.update(value, values);
            }
            
            console.log('✅ Update completed');
            resolve({ data: { ...values, [column]: value }, error: null });
          } catch (error: any) {
            console.error('❌ Update error:', error);
            resolve({ data: null, error: { message: error.message } });
          }
        },
      }),
    }),
    
    delete: () => ({
      eq: (column: string, value: any) => ({
        async then(resolve: any) {
          try {
            if (table === 'processes') {
              await dynamodb.processes.delete(value);
            } else if (table === 'process_documents') {
              await dynamodb.documents.delete(value);
            }
            
            resolve({ error: null });
          } catch (error: any) {
            resolve({ error: { message: error.message } });
          }
        },
      }),
    }),
  }),
};