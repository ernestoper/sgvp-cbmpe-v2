export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string
          process_id: string
          user_id: string
          stage: string
          status: string
          message: string
          whatsapp_status: string | null
          email_status: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          process_id: string
          user_id: string
          stage: string
          status: string
          message: string
          whatsapp_status?: string | null
          email_status?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          process_id?: string
          user_id?: string
          stage?: string
          status?: string
          message?: string
          whatsapp_status?: string | null
          email_status?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      process_documents: {
        Row: {
          document_name: string
          document_type: string
          file_url: string
          id: string
          process_id: string
          rejection_reason: string | null
          correction_justification: string | null
          resubmitted_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          updated_at: string
          uploaded_at: string
          disponivel_usuario: boolean
          carimbado_por: string | null
          data_carimbo: string | null
        }
        Insert: {
          document_name: string
          document_type: string
          file_url: string
          id?: string
          process_id: string
          rejection_reason?: string | null
          correction_justification?: string | null
          resubmitted_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          updated_at?: string
          uploaded_at?: string
          disponivel_usuario?: boolean
          carimbado_por?: string | null
          data_carimbo?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string
          file_url?: string
          id?: string
          process_id?: string
          rejection_reason?: string | null
          correction_justification?: string | null
          resubmitted_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          updated_at?: string
          uploaded_at?: string
          disponivel_usuario?: boolean
          carimbado_por?: string | null
          data_carimbo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_history: {
        Row: {
          created_at: string
          id: string
          observations: string | null
          process_id: string
          responsible_id: string | null
          responsible_name: string | null
          status: Database["public"]["Enums"]["process_status"]
          step_status: Database["public"]["Enums"]["step_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          observations?: string | null
          process_id: string
          responsible_id?: string | null
          responsible_name?: string | null
          status: Database["public"]["Enums"]["process_status"]
          step_status: Database["public"]["Enums"]["step_status"]
        }
        Update: {
          created_at?: string
          id?: string
          observations?: string | null
          process_id?: string
          responsible_id?: string | null
          responsible_name?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          step_status?: Database["public"]["Enums"]["step_status"]
        }
        Relationships: [
          {
            foreignKeyName: "process_history_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_history_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          address: string
          cnpj: string
          company_name: string
          created_at: string
          current_status: Database["public"]["Enums"]["process_status"]
          contact_name: string
          contact_phone: string
          contact_email: string
          id: string
          process_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          cnpj: string
          company_name: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["process_status"]
          contact_name?: string
          contact_phone?: string
          contact_email?: string
          id?: string
          process_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          cnpj?: string
          company_name?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["process_status"]
          contact_name?: string
          contact_phone?: string
          contact_email?: string
          id?: string
          process_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cnpj: string | null
          company_name: string | null
          created_at: string
          full_name: string
          id: string
        }
        Insert: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          full_name: string
          id: string
        }
        Update: {
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      process_status:
        | "cadastro"
        | "triagem"
        | "vistoria"
        | "comissao"
        | "aprovacao"
        | "concluido"
        | "exigencia"
      step_status: "pending" | "in_progress" | "completed" | "rejected"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      process_status: [
        "cadastro",
        "triagem",
        "vistoria",
        "comissao",
        "aprovacao",
        "concluido",
        "exigencia",
      ],
      step_status: ["pending", "in_progress", "completed", "rejected"],
      user_role: ["user", "admin"],
    },
  },
} as const
