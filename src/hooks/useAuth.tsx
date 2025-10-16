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
    try {
      // Verificar se o perfil já existe
      await dynamodb.profiles.getById(user.id);
    } catch (error) {
      // Se não existir, criar
      console.log('Creating user profile for:', user.id);
      try {
        await dynamodb.profiles.create({
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
          cnpj: null,
          company_name: null,
        });
        console.log('User profile created successfully');
      } catch (createError) {
        console.error('Error creating user profile:', createError);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Criar perfil automaticamente se o usuário fez login
        if (session?.user) {
          await ensureUserProfile(session.user);
        }
        
        setLoading(false);
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
