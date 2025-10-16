import { supabase } from "@/integrations/supabase/client";

/**
 * Função auxiliar para criar o usuário admin inicial
 * Deve ser executada apenas uma vez
 */
export const createAdminUser = async () => {
  try {
    // Criar admin user através do signup
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: "admin@cbm.pe.gov.br",
      password: "Admin@CBM2025",
      options: {
        data: {
          full_name: "Administrador CBM-PE",
          role: "admin",
        },
      },
    });

    if (signupError) throw signupError;

    console.log("Admin user created successfully:", signupData.user?.email);
    return { success: true, user: signupData.user };
  } catch (error: any) {
    console.error("Error creating admin user:", error.message);
    return { success: false, error: error.message };
  }
};
