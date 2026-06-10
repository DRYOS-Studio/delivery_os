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
          monthly_cost: number | null
          person_id: string
          role: Database["public"]["Enums"]["allocation_role"]
          start_date: string
          updated_at: string
          weekly_hours: number | null
        }
        Insert: {
          capacity_weekly_pct?: number
          created_at?: string
          end_date?: string | null
          frente_id: string
          id?: string
          monthly_cost?: number | null
          person_id: string
          role: Database["public"]["Enums"]["allocation_role"]
          start_date?: string
          updated_at?: string
          weekly_hours?: number | null
        }
        Update: {
          capacity_weekly_pct?: number
          created_at?: string
          end_date?: string | null
          frente_id?: string
          id?: string
          monthly_cost?: number | null
          person_id?: string
          role?: Database["public"]["Enums"]["allocation_role"]
          start_date?: string
          updated_at?: string
          weekly_hours?: number | null
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
      attachments: {
        Row: {
          created_at: string
          description: string | null
          filename: string
          id: string
          meeting_id: string | null
          mime_type: string
          operation_id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          filename: string
          id?: string
          meeting_id?: string | null
          mime_type: string
          operation_id: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          filename?: string
          id?: string
          meeting_id?: string | null
          mime_type?: string
          operation_id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_attachments_meeting_id"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attachments_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
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
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          cnpj: string | null
          created_at: string
          id: string
          inscricao_estadual: string | null
          legal_name: string | null
          name: string
          notes: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          inscricao_estadual?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
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
      diagnostics: {
        Row: {
          client_id: string
          conducted_at: string | null
          created_at: string
          id: string
          notes: string
          recommended_product:
            | Database["public"]["Enums"]["product_recommendation"]
            | null
          updated_at: string
        }
        Insert: {
          client_id: string
          conducted_at?: string | null
          created_at?: string
          id?: string
          notes: string
          recommended_product?:
            | Database["public"]["Enums"]["product_recommendation"]
            | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          conducted_at?: string | null
          created_at?: string
          id?: string
          notes?: string
          recommended_product?:
            | Database["public"]["Enums"]["product_recommendation"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_diagnostics_client_id"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
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
          product_id: string | null
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
          product_id?: string | null
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
          product_id?: string | null
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
            foreignKeyName: "fk_frentes_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "service_products"
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
      notifications_log: {
        Row: {
          event_type: string
          id: string
          operation_id: string
          payload: Json
          response_status: number | null
          sent_at: string
          subject_id: string
          subject_kind: string
        }
        Insert: {
          event_type: string
          id?: string
          operation_id: string
          payload: Json
          response_status?: number | null
          sent_at?: string
          subject_id: string
          subject_kind: string
        }
        Update: {
          event_type?: string
          id?: string
          operation_id?: string
          payload?: Json
          response_status?: number | null
          sent_at?: string
          subject_id?: string
          subject_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_log_operation"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_costs: {
        Row: {
          amount: number
          created_at: string
          ended_at: string | null
          id: string
          label: string
          notes: string | null
          operation_id: string
          recurrence: Database["public"]["Enums"]["cost_recurrence"]
          started_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          ended_at?: string | null
          id?: string
          label: string
          notes?: string | null
          operation_id: string
          recurrence?: Database["public"]["Enums"]["cost_recurrence"]
          started_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          label?: string
          notes?: string | null
          operation_id?: string
          recurrence?: Database["public"]["Enums"]["cost_recurrence"]
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_operation_costs_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_members: {
        Row: {
          created_at: string
          created_by: string | null
          operation_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          operation_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          operation_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_operation_members_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_operation_members_operation"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_operation_members_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_villain_narratives: {
        Row: {
          created_at: string
          id: string
          narrative_text: string
          operation_id: string
          period_yyyymm: string
          updated_at: string
          villain_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          narrative_text: string
          operation_id: string
          period_yyyymm: string
          updated_at?: string
          villain_id: string
        }
        Update: {
          created_at?: string
          id?: string
          narrative_text?: string
          operation_id?: string
          period_yyyymm?: string
          updated_at?: string
          villain_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ovn_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ovn_villain_id"
            columns: ["villain_id"]
            isOneToOne: false
            referencedRelation: "villains"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_villains: {
        Row: {
          created_at: string
          evidence: string | null
          id: string
          initial_severity: Database["public"]["Enums"]["severity_level"]
          operation_id: string
          progress_pct: number
          updated_at: string
          villain_id: string
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          id?: string
          initial_severity: Database["public"]["Enums"]["severity_level"]
          operation_id: string
          progress_pct?: number
          updated_at?: string
          villain_id: string
        }
        Update: {
          created_at?: string
          evidence?: string | null
          id?: string
          initial_severity?: Database["public"]["Enums"]["severity_level"]
          operation_id?: string
          progress_pct?: number
          updated_at?: string
          villain_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_operation_villains_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_operation_villains_villain_id"
            columns: ["villain_id"]
            isOneToOne: false
            referencedRelation: "villains"
            referencedColumns: ["id"]
          },
        ]
      }
      operations: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          diagnostic_id: string | null
          end_date: string | null
          id: string
          monthly_fixed_cost: number | null
          monthly_recurring_revenue: number | null
          name: string
          notification_webhook_url: string | null
          product_line: Database["public"]["Enums"]["product_line"]
          recurrence: Database["public"]["Enums"]["recurrence"] | null
          resolution_hours: number | null
          response_hours: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["operation_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          diagnostic_id?: string | null
          end_date?: string | null
          id?: string
          monthly_fixed_cost?: number | null
          monthly_recurring_revenue?: number | null
          name: string
          notification_webhook_url?: string | null
          product_line: Database["public"]["Enums"]["product_line"]
          recurrence?: Database["public"]["Enums"]["recurrence"] | null
          resolution_hours?: number | null
          response_hours?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["operation_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          diagnostic_id?: string | null
          end_date?: string | null
          id?: string
          monthly_fixed_cost?: number | null
          monthly_recurring_revenue?: number | null
          name?: string
          notification_webhook_url?: string | null
          product_line?: Database["public"]["Enums"]["product_line"]
          recurrence?: Database["public"]["Enums"]["recurrence"] | null
          resolution_hours?: number | null
          response_hours?: number | null
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
          {
            foreignKeyName: "fk_operations_diagnostic_id"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostics"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          archived_at: string | null
          client_id: string | null
          contracted_weekly_hours: number | null
          created_at: string
          email: string | null
          external_role: string | null
          hourly_rate: number | null
          id: string
          kind: Database["public"]["Enums"]["person_kind"]
          monthly_compensation: number | null
          name: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          contracted_weekly_hours?: number | null
          created_at?: string
          email?: string | null
          external_role?: string | null
          hourly_rate?: number | null
          id?: string
          kind: Database["public"]["Enums"]["person_kind"]
          monthly_compensation?: number | null
          name: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          contracted_weekly_hours?: number | null
          created_at?: string
          email?: string | null
          external_role?: string | null
          hourly_rate?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["person_kind"]
          monthly_compensation?: number | null
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
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
          person_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
          person_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          person_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_person_id"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      public_links: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          label: string | null
          last_accessed_at: string | null
          operation_id: string
          revoked_at: string | null
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          operation_id: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          label?: string | null
          last_accessed_at?: string | null
          operation_id?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_public_links_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_win_catalog: {
        Row: {
          archived_at: string | null
          created_at: string
          default_impact_pct: number | null
          description: string | null
          id: string
          suggested_villain_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_impact_pct?: number | null
          description?: string | null
          id?: string
          suggested_villain_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_impact_pct?: number | null
          description?: string | null
          id?: string
          suggested_villain_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_qwc_villain"
            columns: ["suggested_villain_id"]
            isOneToOne: false
            referencedRelation: "villains"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_win_impacts: {
        Row: {
          created_at: string
          id: string
          impact_pct: number
          operation_villain_id: string
          quick_win_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_pct: number
          operation_villain_id: string
          quick_win_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_pct?: number
          operation_villain_id?: string
          quick_win_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quick_win_impacts_operation_villain_id"
            columns: ["operation_villain_id"]
            isOneToOne: false
            referencedRelation: "operation_villains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quick_win_impacts_quick_win_id"
            columns: ["quick_win_id"]
            isOneToOne: false
            referencedRelation: "quick_wins"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_wins: {
        Row: {
          created_at: string
          description: string | null
          executor_id: string | null
          frente_id: string | null
          happened_at: string
          id: string
          operation_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          executor_id?: string | null
          frente_id?: string | null
          happened_at?: string
          id?: string
          operation_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          executor_id?: string | null
          frente_id?: string | null
          happened_at?: string
          id?: string
          operation_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quick_wins_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quick_wins_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_products: {
        Row: {
          archived_at: string | null
          created_at: string
          default_cycle_type:
            | Database["public"]["Enums"]["frente_cycle_type"]
            | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          default_cycle_type?:
            | Database["public"]["Enums"]["frente_cycle_type"]
            | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          default_cycle_type?:
            | Database["public"]["Enums"]["frente_cycle_type"]
            | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sla_incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          opened_at: string
          opened_by: string | null
          operation_id: string
          resolved_at: string | null
          responded_at: string | null
          severity: Database["public"]["Enums"]["sla_severity"]
          status: Database["public"]["Enums"]["sla_incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          operation_id: string
          resolved_at?: string | null
          responded_at?: string | null
          severity?: Database["public"]["Enums"]["sla_severity"]
          status?: Database["public"]["Enums"]["sla_incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          operation_id?: string
          resolved_at?: string | null
          responded_at?: string | null
          severity?: Database["public"]["Enums"]["sla_severity"]
          status?: Database["public"]["Enums"]["sla_incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sla_incidents_operation_id"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "operations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          person_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_assignees_person_id"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_task_assignees_task_id"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          frente_id: string
          id: string
          parent_task_id: string | null
          quick_win_id: string | null
          sla_incident_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          frente_id: string
          id?: string
          parent_task_id?: string | null
          quick_win_id?: string | null
          sla_incident_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          frente_id?: string
          id?: string
          parent_task_id?: string | null
          quick_win_id?: string | null
          sla_incident_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_frente_id"
            columns: ["frente_id"]
            isOneToOne: false
            referencedRelation: "frentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_parent_task_id"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_quick_win_id"
            columns: ["quick_win_id"]
            isOneToOne: false
            referencedRelation: "quick_wins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tasks_sla_incident_id"
            columns: ["sla_incident_id"]
            isOneToOne: false
            referencedRelation: "sla_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      villains: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string
          display_order: number
          icon_name: string
          id: string
          name: string
          pill_variant: string
          quote: string
          slug: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description: string
          display_order: number
          icon_name: string
          id?: string
          name: string
          pill_variant: string
          quote: string
          slug: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string
          display_order?: number
          icon_name?: string
          id?: string
          name?: string
          pill_variant?: string
          quote?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_operation: { Args: { op_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      allocation_role: "responsavel" | "executor" | "aprovador" | "plantao"
      cost_recurrence: "mensal" | "unica"
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
      product_recommendation: "core" | "spark" | "studio"
      recurrence: "mensal" | "trimestral" | "anual" | "unica"
      severity_level: "low" | "medium" | "high" | "critical"
      sla_incident_status: "open" | "responded" | "resolved" | "cancelled"
      sla_severity: "low" | "medium" | "high"
      task_status: "todo" | "doing" | "blocked" | "done"
      user_role: "admin" | "member"
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
      cost_recurrence: ["mensal", "unica"],
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
      product_recommendation: ["core", "spark", "studio"],
      recurrence: ["mensal", "trimestral", "anual", "unica"],
      severity_level: ["low", "medium", "high", "critical"],
      sla_incident_status: ["open", "responded", "resolved", "cancelled"],
      sla_severity: ["low", "medium", "high"],
      task_status: ["todo", "doing", "blocked", "done"],
      user_role: ["admin", "member"],
    },
  },
} as const
