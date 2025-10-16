import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { dynamodb } from "@/lib/dynamodb";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Função para criar perfil automaticamente
  const ensureUserProfile = async (user: User) => {
    console.log("=== VERIFICANDO/CRIANDO PERFIL DO USUÁRIO ===");
    console.log("User ID:", user.id);
    console.log("User metadata:", user.user_metadata);
    console.log("User email:", user.email);
    
    try {
      console.log("1. Verificando se perfil já existe no DynamoDB...");
      const existingProfile = await dynamodb.profiles.getById(user.id);
      console.log("2. Perfil já existe:", existingProfile);
    } catch (error) {
      console.log("3. Perfil não existe, criando novo perfil...");
      
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
        cnpj: user.user_metadata?.cnpj || null,
        company_name: user.user_metadata?.company_name || null,
      };
      
      console.log("4. Dados do perfil a ser criado:", profileData);
      
      try {
        const result = await dynamodb.profiles.create(profileData);
        console.log("5. Perfil criado com sucesso:", result);
      } catch (createError) {
        console.error("=== ERRO AO CRIAR PERFIL ===");
        console.error("Erro completo:", createError);
        console.error("Dados que tentou criar:", profileData);
      }
    }
    
    console.log("=== FIM DA VERIFICAÇÃO/CRIAÇÃO DO PERFIL ===");
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("=== MUDANÇA DE ESTADO DE AUTENTICAÇÃO ===");
        console.log("Evento:", event);
        console.log("Sessão:", session ? "Ativa" : "Inativa");
        console.log("Usuário:", session?.user?.id || "Nenhum");
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Criar perfil automaticamente se o usuário fez login
        if (session?.user) {
          console.log("Usuário detectado, verificando perfil...");
          await ensureUserProfile(session.user);
        }
        
        setLoading(false);
        console.log("=== FIM DA MUDANÇA DE ESTADO ===");
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Criar perfil automaticamente se já tem sessão ativa
      if (session?.user) {
        await ensureUserProfile(session.user);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
};
