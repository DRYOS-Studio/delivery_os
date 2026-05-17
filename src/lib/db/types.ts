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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allocations: {
        Row: {
          capacity_weekly_pct: number
          created_at: string
          end_date: string | null
          frente_id: string
          id: string
          person_id: string
          role: Database["public"]["Enums"]["allocation_role"]
          start_date: string
          updated_at: string
        }
        Insert: {
          capacity_weekly_pct?: number
          created_at?: string
          end_date?: string | null
          frente_id: string
          id?: string
          person_id: string
          role: Database["public"]["Enums"]["allocation_role"]
          start_date?: string
          updated_at?: string
        }
        Update: {
          capacity_weekly_pct?: number
          created_at?: string
          end_date?: string | null
          frente_id?: string
          id?: string
          person_id?: string
          role?: Database["public"]["Enums"]["allocation_role"]
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_allocations_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_allocations_person_id"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_versions: {
        Row: {
          author_id: string | null
          briefing_id: string
          contexto: string | null
          created_at: string
          escopo_excluido: string | null
          escopo_incluido: string | null
          id: string
          objetivos: string | null
          observacoes: string | null
          premissas: string | null
          riscos: string | null
          stakeholders: string | null
        }
        Insert: {
          author_id?: string | null
          briefing_id: string
          contexto?: string | null
          created_at?: string
          escopo_excluido?: string | null
          escopo_incluido?: string | null
          id?: string
          objetivos?: string | null
          observacoes?: string | null
          premissas?: string | null
          riscos?: string | null
          stakeholders?: string | null
        }
        Update: {
          author_id?: string | null
          briefing_id?: string
          contexto?: string | null
          created_at?: string
          escopo_excluido?: string | null
          escopo_incluido?: string | null
          id?: string
          objetivos?: string | null
          observacoes?: string | null
          premissas?: string | null
          riscos?: string | null
          stakeholders?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_briefing_versions_briefing_id"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          created_at: string
          current_version_id: string | null
          id: string
          operation_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          operation_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          id?: string
          operation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_briefings_current_version_id"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "briefing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_briefings_operation_id"
            columns: ["operation_id"]
            isOneToOne: true
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          context: string | null
          created_at: string
          decided_at: string
          decision: string
          id: string
          meeting_id: string | null
          operation_id: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["decision_visibility"]
        }
        Insert: {
          context?: string | null
          created_at?: string
          decided_at?: string
          decision: string
          id?: string
          meeting_id?: string | null
          operation_id: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["decision_visibility"]
        }
        Update: {
          context?: string | null
          created_at?: string
          decided_at?: string
          decision?: string
          id?: string
          meeting_id?: string | null
          operation_id?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["decision_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_decisions_meeting_id"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_decisions_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      frentes: {
        Row: {
          actionable_status: string
          actionable_status_since: string
          archived_at: string | null
          created_at: string
          cycle_type: Database["public"]["Enums"]["frente_cycle_type"]
          domain: Database["public"]["Enums"]["frente_domain"]
          end_date: string | null
          id: string
          name: string
          operation_id: string
          phase: Database["public"]["Enums"]["frente_phase"]
          responsible_person_id: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          actionable_status: string
          actionable_status_since?: string
          archived_at?: string | null
          created_at?: string
          cycle_type: Database["public"]["Enums"]["frente_cycle_type"]
          domain: Database["public"]["Enums"]["frente_domain"]
          end_date?: string | null
          id?: string
          name: string
          operation_id: string
          phase?: Database["public"]["Enums"]["frente_phase"]
          responsible_person_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          actionable_status?: string
          actionable_status_since?: string
          archived_at?: string | null
          created_at?: string
          cycle_type?: Database["public"]["Enums"]["frente_cycle_type"]
          domain?: Database["public"]["Enums"]["frente_domain"]
          end_date?: string | null
          id?: string
          name?: string
          operation_id?: string
          phase?: Database["public"]["Enums"]["frente_phase"]
          responsible_person_id?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_frentes_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_frentes_responsible_person_id"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          created_at: string
          meeting_id: string
          person_id: string
        }
        Insert: {
          created_at?: string
          meeting_id: string
          person_id: string
        }
        Update: {
          created_at?: string
          meeting_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_meeting_attendees_meeting_id"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_meeting_attendees_person_id"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          operation_id: string
          scheduled_at: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["meeting_visibility"]
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operation_id: string
          scheduled_at?: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["meeting_visibility"]
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operation_id?: string
          scheduled_at?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["meeting_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_meetings_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          end_date: string | null
          id: string
          monthly_recurring_revenue: number | null
          name: string
          product_line: Database["public"]["Enums"]["product_line"]
          recurrence: Database["public"]["Enums"]["recurrence"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["operation_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_recurring_revenue?: number | null
          name: string
          product_line: Database["public"]["Enums"]["product_line"]
          recurrence?: Database["public"]["Enums"]["recurrence"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          monthly_recurring_revenue?: number | null
          name?: string
          product_line?: Database["public"]["Enums"]["product_line"]
          recurrence?: Database["public"]["Enums"]["recurrence"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_operations_client_id"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          archived_at: string | null
          client_id: string | null
          created_at: string
          email: string | null
          external_role: string | null
          id: string
          kind: Database["public"]["Enums"]["person_kind"]
          name: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          external_role?: string | null
          id?: string
          kind: Database["public"]["Enums"]["person_kind"]
          name: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          email?: string | null
          external_role?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["person_kind"]
          name?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_persons_client_id"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      allocation_role: "responsavel" | "executor" | "aprovador" | "plantao"
      decision_visibility: "interno" | "cliente"
      frente_cycle_type: "a" | "b" | "c" | "d" | "e"
      frente_domain: "infra" | "dados_analiticos" | "dados_tecnicos"
      frente_phase: "descoberta" | "execucao" | "entrega" | "encerrada"
      meeting_visibility: "interno" | "cliente"
      operation_status:
        | "em_construcao"
        | "em_operacao"
        | "janela_critica"
        | "arquivada"
      person_kind: "internal" | "external"
      product_line: "core" | "spark" | "studio"
      recurrence: "mensal" | "trimestral" | "anual" | "unica"
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
      allocation_role: ["responsavel", "executor", "aprovador", "plantao"],
      decision_visibility: ["interno", "cliente"],
      frente_cycle_type: ["a", "b", "c", "d", "e"],
      frente_domain: ["infra", "dados_analiticos", "dados_tecnicos"],
      frente_phase: ["descoberta", "execucao", "entrega", "encerrada"],
      meeting_visibility: ["interno", "cliente"],
      operation_status: [
        "em_construcao",
        "em_operacao",
        "janela_critica",
        "arquivada",
      ],
      person_kind: ["internal", "external"],
      product_line: ["core", "spark", "studio"],
      recurrence: ["mensal", "trimestral", "anual", "unica"],
    },
  },
} as const
