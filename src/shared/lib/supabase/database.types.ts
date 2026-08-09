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
      gsc_page_daily_summary: {
        Row: {
          avg_ctr: number
          avg_position: number
          date: string
          id: string
          page_slug: string
          site_url: string
          total_clicks: number
          total_impressions: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_ctr?: number
          avg_position?: number
          date: string
          id?: string
          page_slug: string
          site_url: string
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_ctr?: number
          avg_position?: number
          date?: string
          id?: string
          page_slug?: string
          site_url?: string
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_page_daily_summary_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_page_query_summary: {
        Row: {
          avg_ctr: number
          avg_position: number
          id: string
          max_date: string
          min_date: string
          page_slug: string
          query: string
          site_url: string
          total_clicks: number
          total_impressions: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avg_ctr?: number
          avg_position?: number
          id?: string
          max_date: string
          min_date: string
          page_slug: string
          query: string
          site_url: string
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avg_ctr?: number
          avg_position?: number
          id?: string
          max_date?: string
          min_date?: string
          page_slug?: string
          query?: string
          site_url?: string
          total_clicks?: number
          total_impressions?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_page_query_summary_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_search_analytics_rows: {
        Row: {
          clicks: number
          country: string
          created_at: string
          ctr: number
          date: string
          device: string
          id: string
          impressions: number
          page_slug: string
          page_url: string
          position: number
          pulled_at: string
          query: string
          search_type: string
          site_url: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          clicks?: number
          country: string
          created_at?: string
          ctr?: number
          date: string
          device: string
          id?: string
          impressions?: number
          page_slug: string
          page_url: string
          position?: number
          pulled_at?: string
          query: string
          search_type?: string
          site_url: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          clicks?: number
          country?: string
          created_at?: string
          ctr?: number
          date?: string
          device?: string
          id?: string
          impressions?: number
          page_slug?: string
          page_url?: string
          position?: number
          pulled_at?: string
          query?: string
          search_type?: string
          site_url?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_search_analytics_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_sync_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: string | null
          id: string
          rows_synced: number | null
          started_at: string
          status: string
          target_date: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string
          status: string
          target_date: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          id?: string
          rows_synced?: number | null
          started_at?: string
          status?: string
          target_date?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_sync_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }

      accounting_entries: {
        Row: {
          amount_excl_btw_cents: number
          amount_incl_btw_cents: number
          btw_amount_cents: number
          btw_rate_bp: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          direction: Database["public"]["Enums"]["accounting_entry_direction"]
          document_id: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          occurred_on: string
          party_name: string | null
          party_vat_number: string | null
          period_id: string | null
          reconciled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_excl_btw_cents: number
          amount_incl_btw_cents: number
          btw_amount_cents: number
          btw_rate_bp: number
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          direction: Database["public"]["Enums"]["accounting_entry_direction"]
          document_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          occurred_on: string
          party_name?: string | null
          party_vat_number?: string | null
          period_id?: string | null
          reconciled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_excl_btw_cents?: number
          amount_incl_btw_cents?: number
          btw_amount_cents?: number
          btw_rate_bp?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["accounting_entry_direction"]
          document_id?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          occurred_on?: string
          party_name?: string | null
          party_vat_number?: string | null
          period_id?: string | null
          reconciled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          ends_on: string
          id: string
          kind: Database["public"]["Enums"]["accounting_period_kind"]
          starts_on: string
          workspace_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          ends_on: string
          id?: string
          kind: Database["public"]["Enums"]["accounting_period_kind"]
          starts_on: string
          workspace_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          kind?: Database["public"]["Enums"]["accounting_period_kind"]
          starts_on?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_reports: {
        Row: {
          document_id: string | null
          format: Database["public"]["Enums"]["accounting_report_format"]
          generated_at: string
          generated_by: string | null
          id: string
          kind: Database["public"]["Enums"]["accounting_report_kind"]
          period_id: string | null
          totals: Json
          workspace_id: string
        }
        Insert: {
          document_id?: string | null
          format: Database["public"]["Enums"]["accounting_report_format"]
          generated_at?: string
          generated_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["accounting_report_kind"]
          period_id?: string | null
          totals?: Json
          workspace_id: string
        }
        Update: {
          document_id?: string | null
          format?: Database["public"]["Enums"]["accounting_report_format"]
          generated_at?: string
          generated_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["accounting_report_kind"]
          period_id?: string | null
          totals?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_reports_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_reports_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_ledger: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          delta_millicents: number
          id: string
          metadata: Json
          notes: string | null
          reason: string
          usage_event_id: string | null
          workspace_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          delta_millicents: number
          id?: string
          metadata?: Json
          notes?: string | null
          reason: string
          usage_event_id?: string | null
          workspace_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          delta_millicents?: number
          id?: string
          metadata?: Json
          notes?: string | null
          reason?: string
          usage_event_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_ledger_usage_event_id_fkey"
            columns: ["usage_event_id"]
            isOneToOne: false
            referencedRelation: "ai_usage_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_credit_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_execution_runs: {
        Row: {
          authorization_kind: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          operation: string
          profile_id: string | null
          prompt_hash: string
          prompt_id: string
          prompt_version: string
          requested_model_alias: string
          resolved_model_alias: string | null
          resolved_model_id: string | null
          route: string
          runtime_metadata: Json
          started_at: string
          status: string
          workspace_id: string
        }
        Insert: {
          authorization_kind: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation: string
          profile_id?: string | null
          prompt_hash: string
          prompt_id: string
          prompt_version: string
          requested_model_alias: string
          resolved_model_alias?: string | null
          resolved_model_id?: string | null
          route: string
          runtime_metadata?: Json
          started_at?: string
          status?: string
          workspace_id: string
        }
        Update: {
          authorization_kind?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          operation?: string
          profile_id?: string | null
          prompt_hash?: string
          prompt_id?: string
          prompt_version?: string
          requested_model_alias?: string
          resolved_model_alias?: string | null
          resolved_model_id?: string | null
          route?: string
          runtime_metadata?: Json
          started_at?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_execution_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_request_log: {
        Row: {
          created_at: string
          id: string
          route: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          route: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          route?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          base_cost_millicents: number
          char_count: number | null
          charged_millicents: number
          created_at: string
          id: string
          image_count: number | null
          metadata: Json
          model: string
          platform_fee_millicents: number
          profile_id: string | null
          route: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
          unit_type: string
          workspace_id: string
        }
        Insert: {
          base_cost_millicents: number
          char_count?: number | null
          charged_millicents: number
          created_at?: string
          id?: string
          image_count?: number | null
          metadata?: Json
          model: string
          platform_fee_millicents: number
          profile_id?: string | null
          route: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          unit_type: string
          workspace_id: string
        }
        Update: {
          base_cost_millicents?: number
          char_count?: number | null
          charged_millicents?: number
          created_at?: string
          id?: string
          image_count?: number | null
          metadata?: Json
          model?: string
          platform_fee_millicents?: number
          profile_id?: string | null
          route?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          unit_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          content_id: string | null
          created_at: string
          event_name: string
          event_type: string
          id: string
          metadata: Json
          page_slug: string | null
          path: string | null
          referrer: string | null
          session_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
          workspace_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          event_name: string
          event_type: string
          id?: string
          metadata?: Json
          page_slug?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          event_name?: string
          event_type?: string
          id?: string
          metadata?: Json
          page_slug?: string | null
          path?: string | null
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_ingestion_logs: {
        Row: {
          created_at: string
          event_name: string | null
          event_type: string | null
          id: string
          metadata: Json
          path: string | null
          reason: string | null
          request_fingerprint: string | null
          status: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_name?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json
          path?: string | null
          reason?: string | null
          request_fingerprint?: string | null
          status: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json
          path?: string | null
          reason?: string | null
          request_fingerprint?: string | null
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_ingestion_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      anti_abuse_events: {
        Row: {
          booking_reservation_id: string | null
          created_at: string
          decision: string
          email_hash: string | null
          id: string
          ip_hash: string | null
          metadata: Json
          portal_client_id: string | null
          reason_codes: Json
          request_fingerprint: string | null
          risk_level: string
          risk_score: number
          source_path: string
          surface: string
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          booking_reservation_id?: string | null
          created_at?: string
          decision: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          portal_client_id?: string | null
          reason_codes?: Json
          request_fingerprint?: string | null
          risk_level: string
          risk_score?: number
          source_path: string
          surface: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          booking_reservation_id?: string | null
          created_at?: string
          decision?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          portal_client_id?: string | null
          reason_codes?: Json
          request_fingerprint?: string | null
          risk_level?: string
          risk_score?: number
          source_path?: string
          surface?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anti_abuse_events_booking_reservation_id_fkey"
            columns: ["booking_reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anti_abuse_events_portal_client_id_fkey"
            columns: ["portal_client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anti_abuse_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      anti_abuse_rules: {
        Row: {
          action: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          reason: string | null
          subject_type: string
          subject_value_hash: string
          surface: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          subject_type: string
          subject_value_hash: string
          surface: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          subject_type?: string
          subject_value_hash?: string
          surface?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anti_abuse_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_enhancement_proposal_events: {
        Row: {
          content_id: string
          decided_at: string
          decision: string
          id: string
          proposal_id: string
          proposal_type: string
          risk_flags: string[]
          run_id: string
          signal_key: string
          workspace_id: string
        }
        Insert: {
          content_id: string
          decided_at?: string
          decision: string
          id?: string
          proposal_id: string
          proposal_type: string
          risk_flags?: string[]
          run_id: string
          signal_key: string
          workspace_id: string
        }
        Update: {
          content_id?: string
          decided_at?: string
          decision?: string
          id?: string
          proposal_id?: string
          proposal_type?: string
          risk_flags?: string[]
          run_id?: string
          signal_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_enhancement_proposal_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_enhancement_proposal_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "blog_seo_enhancement_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_enhancement_proposal_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_seo_enhancement_runs: {
        Row: {
          accepted_count: number
          actor_profile_id: string | null
          applied_at: string | null
          content_id: string
          created_at: string
          expires_at: string
          id: string
          preview_payload: Json
          proposal_count: number
          rolled_back_at: string | null
          snapshot_after: Json | null
          snapshot_before: Json
          status: string
          total_charged_millicents: number
          workspace_id: string
        }
        Insert: {
          accepted_count?: number
          actor_profile_id?: string | null
          applied_at?: string | null
          content_id: string
          created_at?: string
          expires_at: string
          id?: string
          preview_payload: Json
          proposal_count?: number
          rolled_back_at?: string | null
          snapshot_after?: Json | null
          snapshot_before: Json
          status?: string
          total_charged_millicents?: number
          workspace_id: string
        }
        Update: {
          accepted_count?: number
          actor_profile_id?: string | null
          applied_at?: string | null
          content_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          preview_payload?: Json
          proposal_count?: number
          rolled_back_at?: string | null
          snapshot_after?: Json | null
          snapshot_before?: Json
          status?: string
          total_charged_millicents?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_seo_enhancement_runs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_seo_enhancement_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_availability_rules: {
        Row: {
          created_at: string
          date_json: Json
          ends_on: string | null
          id: string
          is_active: boolean
          location_id: string | null
          metadata: Json
          priority: number
          resource_id: string | null
          rule_type: Database["public"]["Enums"]["booking_availability_rule_type"]
          scope_type: Database["public"]["Enums"]["booking_rule_scope_type"]
          service_id: string | null
          starts_on: string | null
          template_profile_id: string | null
          time_windows_json: Json
          timezone: string
          updated_at: string
          weekday_json: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date_json?: Json
          ends_on?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          metadata?: Json
          priority?: number
          resource_id?: string | null
          rule_type: Database["public"]["Enums"]["booking_availability_rule_type"]
          scope_type: Database["public"]["Enums"]["booking_rule_scope_type"]
          service_id?: string | null
          starts_on?: string | null
          template_profile_id?: string | null
          time_windows_json?: Json
          timezone: string
          updated_at?: string
          weekday_json?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          date_json?: Json
          ends_on?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          metadata?: Json
          priority?: number
          resource_id?: string | null
          rule_type?: Database["public"]["Enums"]["booking_availability_rule_type"]
          scope_type?: Database["public"]["Enums"]["booking_rule_scope_type"]
          service_id?: string | null
          starts_on?: string | null
          template_profile_id?: string | null
          time_windows_json?: Json
          timezone?: string
          updated_at?: string
          weekday_json?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_availability_rules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "booking_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_availability_rules_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_availability_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_availability_rules_template_profile_id_fkey"
            columns: ["template_profile_id"]
            isOneToOne: false
            referencedRelation: "booking_template_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_availability_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_blackout_windows: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          location_id: string | null
          metadata: Json
          reason: string | null
          resource_id: string | null
          service_id: string | null
          source: string | null
          starts_at: string
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          service_id?: string | null
          source?: string | null
          starts_at: string
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          location_id?: string | null
          metadata?: Json
          reason?: string | null
          resource_id?: string | null
          service_id?: string | null
          source?: string | null
          starts_at?: string
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_blackout_windows_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "booking_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_blackout_windows_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_blackout_windows_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_blackout_windows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_form_definitions: {
        Row: {
          completion_rules_json: Json
          copy_i18n: Json
          created_at: string
          form_key: string
          id: string
          is_active: boolean
          metadata: Json
          schema_json: Json
          template_profile_id: string
          title: string
          ui_schema_json: Json
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          completion_rules_json?: Json
          copy_i18n?: Json
          created_at?: string
          form_key: string
          id?: string
          is_active?: boolean
          metadata?: Json
          schema_json?: Json
          template_profile_id: string
          title: string
          ui_schema_json?: Json
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          completion_rules_json?: Json
          copy_i18n?: Json
          created_at?: string
          form_key?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          schema_json?: Json
          template_profile_id?: string
          title?: string
          ui_schema_json?: Json
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_form_definitions_template_profile_id_fkey"
            columns: ["template_profile_id"]
            isOneToOne: false
            referencedRelation: "booking_template_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_form_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_locations: {
        Row: {
          address_json: Json
          capacity_value: number | null
          copy_i18n: Json
          created_at: string
          geo_json: Json
          id: string
          instructions: string | null
          is_active: boolean
          location_type: Database["public"]["Enums"]["booking_location_type"]
          metadata: Json
          name: string
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          address_json?: Json
          capacity_value?: number | null
          copy_i18n?: Json
          created_at?: string
          geo_json?: Json
          id?: string
          instructions?: string | null
          is_active?: boolean
          location_type: Database["public"]["Enums"]["booking_location_type"]
          metadata?: Json
          name: string
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          address_json?: Json
          capacity_value?: number | null
          copy_i18n?: Json
          created_at?: string
          geo_json?: Json
          id?: string
          instructions?: string | null
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["booking_location_type"]
          metadata?: Json
          name?: string
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_locations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_notification_events: {
        Row: {
          channel: Database["public"]["Enums"]["booking_notification_channel"]
          created_at: string
          claim_expires_at: string | null
          delivery_status: Database["public"]["Enums"]["booking_notification_delivery_status"]
          event_type: Database["public"]["Enums"]["booking_notification_event_type"]
          id: string
          idempotency_key: string | null
          payload_json: Json
          provider_message_id: string | null
          reservation_id: string
          sent_at: string | null
          workspace_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["booking_notification_channel"]
          claim_expires_at?: string | null
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["booking_notification_delivery_status"]
          event_type: Database["public"]["Enums"]["booking_notification_event_type"]
          id?: string
          idempotency_key?: string | null
          payload_json?: Json
          provider_message_id?: string | null
          reservation_id: string
          sent_at?: string | null
          workspace_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["booking_notification_channel"]
          claim_expires_at?: string | null
          created_at?: string
          delivery_status?: Database["public"]["Enums"]["booking_notification_delivery_status"]
          event_type?: Database["public"]["Enums"]["booking_notification_event_type"]
          id?: string
          idempotency_key?: string | null
          payload_json?: Json
          provider_message_id?: string | null
          reservation_id?: string
          sent_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notification_events_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_notification_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          customer_instructions: string | null
          deadline_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json
          net_amount_cents: number | null
          vat_rate_basis_points: number | null
          vat_amount_cents: number | null
          gross_amount_cents: number | null
          pricing_version: string | null
          payment_reference: string
          payment_url: string | null
          paypal_capture_id: string | null
          paypal_fee_cents: number | null
          paypal_net_cents: number | null
          paypal_order_id: string | null
          paypal_payer_email: string | null
          paypal_payer_id: string | null
          paypal_status: string | null
          provider: string
          provider_event_id: string | null
          provider_event_type: string | null
          provider_synced_at: string | null
          refund_amount_cents: number | null
          refunded_at: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["booking_payment_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_note: string | null
          workspace_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          customer_instructions?: string | null
          deadline_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json
          net_amount_cents?: number | null
          vat_rate_basis_points?: number | null
          vat_amount_cents?: number | null
          gross_amount_cents?: number | null
          pricing_version?: string | null
          payment_reference: string
          payment_url?: string | null
          paypal_capture_id?: string | null
          paypal_fee_cents?: number | null
          paypal_net_cents?: number | null
          paypal_order_id?: string | null
          paypal_payer_email?: string | null
          paypal_payer_id?: string | null
          paypal_status?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_event_type?: string | null
          provider_synced_at?: string | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["booking_payment_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_note?: string | null
          workspace_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          customer_instructions?: string | null
          deadline_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json
          net_amount_cents?: number | null
          vat_rate_basis_points?: number | null
          vat_amount_cents?: number | null
          gross_amount_cents?: number | null
          pricing_version?: string | null
          payment_reference?: string
          payment_url?: string | null
          paypal_capture_id?: string | null
          paypal_fee_cents?: number | null
          paypal_net_cents?: number | null
          paypal_order_id?: string | null
          paypal_payer_email?: string | null
          paypal_payer_id?: string | null
          paypal_status?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_event_type?: string | null
          provider_synced_at?: string | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["booking_payment_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_note?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_workspace_reservation_fk"
            columns: ["workspace_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "booking_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_calendar_cleanup_tasks: {
        Row: {
          id: string
          workspace_id: string
          reservation_id: string
          connection_id: string
          external_event_id: string
          status: string
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          reservation_id: string
          connection_id: string
          external_event_id: string
          status?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          reservation_id?: string
          connection_id?: string
          external_event_id?: string
          status?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_calendar_cleanup_tasks_workspace_reservation_fk"
            columns: ["workspace_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "booking_calendar_cleanup_tasks_workspace_connection_fk"
            columns: ["workspace_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "workspace_calendar_connections"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      booking_meetings: {
        Row: {
          id: string
          workspace_id: string
          reservation_id: string
          provider: string
          provider_meeting_id: string | null
          calendar_event_id: string | null
          calendar_connection_id: string | null
          provisioning_token: string | null
          provisioning_expires_at: string | null
          join_url: string | null
          status: string
          scheduled_start: string
          scheduled_end: string
          last_error: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          reservation_id: string
          provider: string
          provider_meeting_id?: string | null
          calendar_event_id?: string | null
          calendar_connection_id?: string | null
          provisioning_token?: string | null
          provisioning_expires_at?: string | null
          join_url?: string | null
          status?: string
          scheduled_start: string
          scheduled_end: string
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          reservation_id?: string
          provider?: string
          provider_meeting_id?: string | null
          calendar_event_id?: string | null
          calendar_connection_id?: string | null
          provisioning_token?: string | null
          provisioning_expires_at?: string | null
          join_url?: string | null
          status?: string
          scheduled_start?: string
          scheduled_end?: string
          last_error?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_meetings_workspace_reservation_fk"
            columns: ["workspace_id", "reservation_id"]
            isOneToOne: true
            referencedRelation: "booking_reservations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "booking_meetings_workspace_calendar_connection_fk"
            columns: ["workspace_id", "calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "workspace_calendar_connections"
            referencedColumns: ["workspace_id", "id"]
          },
        ]
      }
      booking_reservation_intake: {
        Row: {
          consent_flags_json: Json
          created_at: string
          form_definition_id: string | null
          id: string
          normalized_payload_json: Json
          reservation_id: string
          submitted_payload_json: Json
          workspace_id: string
        }
        Insert: {
          consent_flags_json?: Json
          created_at?: string
          form_definition_id?: string | null
          id?: string
          normalized_payload_json?: Json
          reservation_id: string
          submitted_payload_json?: Json
          workspace_id: string
        }
        Update: {
          consent_flags_json?: Json
          created_at?: string
          form_definition_id?: string | null
          id?: string
          normalized_payload_json?: Json
          reservation_id?: string
          submitted_payload_json?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reservation_intake_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "booking_form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservation_intake_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "booking_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservation_intake_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reservations: {
        Row: {
          attribution_json: Json
          business_timezone: string | null
          capacity_mode_snapshot: string
          capacity_value_snapshot: number
          created_at: string
          customer_email: string
          customer_full_name: string
          customer_phone: string | null
          extension_state_json: Json
          form_definition_id: string | null
          id: string
          idempotency_key: string | null
          submission_fingerprint: string | null
          location_id: string | null
          manual_review_reason: string | null
          metadata: Json
          notes_customer: string | null
          notes_internal: string | null
          party_size: number
          payment_deadline_at: string | null
          portal_client_id: string | null
          public_reference: string
          requires_manual_review: boolean
          reservation_timezone: string
          resource_id: string | null
          scheduled_end: string
          scheduled_start: string
          submission_lease_expires_at: string | null
          submission_lease_id: string | null
          service_id: string
          source_campaign: string | null
          source_channel: string | null
          source_referrer: string | null
          status: Database["public"]["Enums"]["booking_reservation_status"]
          template_profile_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attribution_json?: Json
          business_timezone?: string | null
          capacity_mode_snapshot?: string
          capacity_value_snapshot?: number
          created_at?: string
          customer_email: string
          customer_full_name: string
          customer_phone?: string | null
          extension_state_json?: Json
          form_definition_id?: string | null
          id?: string
          idempotency_key?: string | null
          submission_fingerprint?: string | null
          location_id?: string | null
          manual_review_reason?: string | null
          metadata?: Json
          notes_customer?: string | null
          notes_internal?: string | null
          party_size?: number
          payment_deadline_at?: string | null
          portal_client_id?: string | null
          public_reference: string
          requires_manual_review?: boolean
          reservation_timezone: string
          resource_id?: string | null
          scheduled_end: string
          scheduled_start: string
          submission_lease_expires_at?: string | null
          submission_lease_id?: string | null
          service_id: string
          source_campaign?: string | null
          source_channel?: string | null
          source_referrer?: string | null
          status?: Database["public"]["Enums"]["booking_reservation_status"]
          template_profile_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attribution_json?: Json
          business_timezone?: string | null
          capacity_mode_snapshot?: string
          capacity_value_snapshot?: number
          created_at?: string
          customer_email?: string
          customer_full_name?: string
          customer_phone?: string | null
          extension_state_json?: Json
          form_definition_id?: string | null
          id?: string
          idempotency_key?: string | null
          submission_fingerprint?: string | null
          location_id?: string | null
          manual_review_reason?: string | null
          metadata?: Json
          notes_customer?: string | null
          notes_internal?: string | null
          party_size?: number
          payment_deadline_at?: string | null
          portal_client_id?: string | null
          public_reference?: string
          requires_manual_review?: boolean
          reservation_timezone?: string
          resource_id?: string | null
          scheduled_end?: string
          scheduled_start?: string
          submission_lease_expires_at?: string | null
          submission_lease_id?: string | null
          service_id?: string
          source_campaign?: string | null
          source_channel?: string | null
          source_referrer?: string | null
          status?: Database["public"]["Enums"]["booking_reservation_status"]
          template_profile_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reservations_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "booking_form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "booking_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_portal_client_id_fkey"
            columns: ["portal_client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_template_profile_id_fkey"
            columns: ["template_profile_id"]
            isOneToOne: false
            referencedRelation: "booking_template_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_reservations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_resources: {
        Row: {
          attributes_json: Json
          capacity_value: number
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          resource_type: Database["public"]["Enums"]["booking_resource_type"]
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attributes_json?: Json
          capacity_value?: number
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          resource_type: Database["public"]["Enums"]["booking_resource_type"]
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attributes_json?: Json
          capacity_value?: number
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          resource_type?: Database["public"]["Enums"]["booking_resource_type"]
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rule_definitions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          priority: number
          rule_key: string
          rule_type: string
          rule_value_json: Json
          service_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          rule_key: string
          rule_type: string
          rule_value_json?: Json
          service_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          rule_key?: string
          rule_type?: string
          rule_value_json?: Json
          service_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rule_definitions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_rule_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_locations: {
        Row: {
          created_at: string
          is_default: boolean
          location_id: string
          metadata: Json
          service_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          is_default?: boolean
          location_id: string
          metadata?: Json
          service_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          is_default?: boolean
          location_id?: string
          metadata?: Json
          service_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "booking_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_locations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_locations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_service_resources: {
        Row: {
          assignment_mode: string
          created_at: string
          metadata: Json
          resource_id: string
          service_id: string
          workspace_id: string
        }
        Insert: {
          assignment_mode?: string
          created_at?: string
          metadata?: Json
          resource_id: string
          service_id: string
          workspace_id: string
        }
        Update: {
          assignment_mode?: string
          created_at?: string
          metadata?: Json
          resource_id?: string
          service_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_resources_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "booking_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_service_resources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_services: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          capacity_mode: Database["public"]["Enums"]["booking_capacity_mode"]
          capacity_value: number
          copy_i18n: Json
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          lead_time_minutes: number
          location_mode: Database["public"]["Enums"]["booking_location_mode"]
          max_advance_days: number
          metadata: Json
          vat_rate_basis_points: number
          virtual_meeting_provider: string
          auto_create_virtual_meeting: boolean
          payment_deadline_minutes: number
          payment_instructions: string | null
          payment_provider: string
          payment_required: boolean
          payment_url: string | null
          price_amount_cents: number | null
          price_currency: string
          requires_manual_review: boolean
          service_key: string
          service_type: string
          subtitle: string | null
          template_profile_id: string
          title: string
          updated_at: string
          visibility_status: Database["public"]["Enums"]["booking_service_visibility_status"]
          workspace_id: string
        }
        Insert: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          capacity_mode?: Database["public"]["Enums"]["booking_capacity_mode"]
          capacity_value?: number
          copy_i18n?: Json
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          lead_time_minutes?: number
          location_mode?: Database["public"]["Enums"]["booking_location_mode"]
          max_advance_days?: number
          metadata?: Json
          vat_rate_basis_points?: number
          virtual_meeting_provider?: string
          auto_create_virtual_meeting?: boolean
          payment_deadline_minutes?: number
          payment_instructions?: string | null
          payment_provider?: string
          payment_required?: boolean
          payment_url?: string | null
          price_amount_cents?: number | null
          price_currency?: string
          requires_manual_review?: boolean
          service_key: string
          service_type: string
          subtitle?: string | null
          template_profile_id: string
          title: string
          updated_at?: string
          visibility_status?: Database["public"]["Enums"]["booking_service_visibility_status"]
          workspace_id: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          capacity_mode?: Database["public"]["Enums"]["booking_capacity_mode"]
          capacity_value?: number
          copy_i18n?: Json
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          lead_time_minutes?: number
          location_mode?: Database["public"]["Enums"]["booking_location_mode"]
          max_advance_days?: number
          metadata?: Json
          vat_rate_basis_points?: number
          virtual_meeting_provider?: string
          auto_create_virtual_meeting?: boolean
          payment_deadline_minutes?: number
          payment_instructions?: string | null
          payment_provider?: string
          payment_required?: boolean
          payment_url?: string | null
          price_amount_cents?: number | null
          price_currency?: string
          requires_manual_review?: boolean
          service_key?: string
          service_type?: string
          subtitle?: string | null
          template_profile_id?: string
          title?: string
          updated_at?: string
          visibility_status?: Database["public"]["Enums"]["booking_service_visibility_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_template_profile_id_fkey"
            columns: ["template_profile_id"]
            isOneToOne: false
            referencedRelation: "booking_template_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_staff_profiles: {
        Row: {
          avatar_asset_url: string | null
          bio: string | null
          contact_rules_json: Json
          created_at: string
          display_name: string
          id: string
          is_bookable: boolean
          languages_json: Json
          metadata: Json
          resource_id: string
          role_label: string | null
          specialties_json: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_asset_url?: string | null
          bio?: string | null
          contact_rules_json?: Json
          created_at?: string
          display_name: string
          id?: string
          is_bookable?: boolean
          languages_json?: Json
          metadata?: Json
          resource_id: string
          role_label?: string | null
          specialties_json?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_asset_url?: string | null
          bio?: string | null
          contact_rules_json?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_bookable?: boolean
          languages_json?: Json
          metadata?: Json
          resource_id?: string
          role_label?: string | null
          specialties_json?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_staff_profiles_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "booking_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_staff_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["booking_actor_type"]
          created_at: string
          from_status:
            | Database["public"]["Enums"]["booking_reservation_status"]
            | null
          id: string
          payload_json: Json
          reason: string | null
          reservation_id: string
          to_status: Database["public"]["Enums"]["booking_reservation_status"]
          trigger_source: Database["public"]["Enums"]["booking_trigger_source"]
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["booking_actor_type"]
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["booking_reservation_status"]
            | null
          id?: string
          payload_json?: Json
          reason?: string | null
          reservation_id: string
          to_status: Database["public"]["Enums"]["booking_reservation_status"]
          trigger_source: Database["public"]["Enums"]["booking_trigger_source"]
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["booking_actor_type"]
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["booking_reservation_status"]
            | null
          id?: string
          payload_json?: Json
          reason?: string | null
          reservation_id?: string
          to_status?: Database["public"]["Enums"]["booking_reservation_status"]
          trigger_source?: Database["public"]["Enums"]["booking_trigger_source"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_status_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_template_profiles: {
        Row: {
          analytics_json: Json
          branding_json: Json
          created_at: string
          entity_mode: Database["public"]["Enums"]["booking_entity_mode"]
          id: string
          placement_config_json: Json
          profile_key: string
          published_at: string | null
          settings_json: Json
          slot_strategy: Database["public"]["Enums"]["booking_slot_strategy"]
          status: Database["public"]["Enums"]["booking_profile_status"]
          template_key: Database["public"]["Enums"]["booking_template_key"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analytics_json?: Json
          branding_json?: Json
          created_at?: string
          entity_mode?: Database["public"]["Enums"]["booking_entity_mode"]
          id?: string
          placement_config_json?: Json
          profile_key?: string
          published_at?: string | null
          settings_json?: Json
          slot_strategy?: Database["public"]["Enums"]["booking_slot_strategy"]
          status?: Database["public"]["Enums"]["booking_profile_status"]
          template_key: Database["public"]["Enums"]["booking_template_key"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analytics_json?: Json
          branding_json?: Json
          created_at?: string
          entity_mode?: Database["public"]["Enums"]["booking_entity_mode"]
          id?: string
          placement_config_json?: Json
          profile_key?: string
          published_at?: string | null
          settings_json?: Json
          slot_strategy?: Database["public"]["Enums"]["booking_slot_strategy"]
          status?: Database["public"]["Enums"]["booking_profile_status"]
          template_key?: Database["public"]["Enums"]["booking_template_key"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_template_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          capability_key: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          capability_key: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          capability_key?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cleaning_schedule_notes: {
        Row: {
          author_kind: string
          author_profile_id: string | null
          body: string
          cleaning_schedule_id: string
          created_at: string
          id: string
          is_flag: boolean
          is_resolution: boolean
          workspace_id: string
        }
        Insert: {
          author_kind: string
          author_profile_id?: string | null
          body: string
          cleaning_schedule_id: string
          created_at?: string
          id?: string
          is_flag?: boolean
          is_resolution?: boolean
          workspace_id: string
        }
        Update: {
          author_kind?: string
          author_profile_id?: string | null
          body?: string
          cleaning_schedule_id?: string
          created_at?: string
          id?: string
          is_flag?: boolean
          is_resolution?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedule_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedule_notes_cleaning_schedule_id_fkey"
            columns: ["cleaning_schedule_id"]
            isOneToOne: false
            referencedRelation: "cleaning_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_schedule_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_schedules: {
        Row: {
          created_at: string
          frequency: string | null
          frequency_kind: Database["public"]["Enums"]["cleaning_schedule_frequency_kind"]
          frequency_value_days: number | null
          grace_period_days: number
          id: string
          last_completed_at: string | null
          location_id: string
          status: string
          task_name: string
        }
        Insert: {
          created_at?: string
          frequency?: string | null
          frequency_kind?: Database["public"]["Enums"]["cleaning_schedule_frequency_kind"]
          frequency_value_days?: number | null
          grace_period_days?: number
          id?: string
          last_completed_at?: string | null
          location_id: string
          status?: string
          task_name: string
        }
        Update: {
          created_at?: string
          frequency?: string | null
          frequency_kind?: Database["public"]["Enums"]["cleaning_schedule_frequency_kind"]
          frequency_value_days?: number | null
          grace_period_days?: number
          id?: string
          last_completed_at?: string | null
          location_id?: string
          status?: string
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "facility_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_inquiries: {
        Row: {
          challenge: string | null
          company: string | null
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          locale: string
          marketing_consent: boolean
          metadata: Json
          request_type: string | null
          status: string
          submission_fingerprint: string | null
          submission_id: string
          timeline: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          challenge?: string | null
          company?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          id?: string
          locale?: string
          marketing_consent?: boolean
          metadata?: Json
          request_type?: string | null
          status?: string
          submission_fingerprint?: string | null
          submission_id: string
          timeline?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          challenge?: string | null
          company?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          locale?: string
          marketing_consent?: boolean
          metadata?: Json
          request_type?: string | null
          status?: string
          submission_fingerprint?: string | null
          submission_id?: string
          timeline?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_inquiries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          profile_id: string | null
          workspace_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          workspace_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          profile_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_users_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_embeddings: {
        Row: {
          content_chunk: string
          content_id: string | null
          embedding: string | null
          id: number
        }
        Insert: {
          content_chunk: string
          content_id?: string | null
          embedding?: string | null
          id?: number
        }
        Update: {
          content_chunk?: string
          content_id?: string | null
          embedding?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_embeddings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_runs: {
        Row: {
          completed_at: string | null
          content_item_id: string | null
          created_at: string
          current_phase: string | null
          derived_outputs: Json
          error_code: string | null
          error_message: string | null
          id: string
          input_summary: Json
          phase_state: Json
          profile_id: string | null
          requested_formats: string[]
          started_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          content_item_id?: string | null
          created_at?: string
          current_phase?: string | null
          derived_outputs?: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_summary?: Json
          phase_state?: Json
          profile_id?: string | null
          requested_formats?: string[]
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          content_item_id?: string | null
          created_at?: string
          current_phase?: string | null
          derived_outputs?: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_summary?: Json
          phase_state?: Json
          profile_id?: string | null
          requested_formats?: string[]
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_runs_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_generation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          author_id: string | null
          content_markdown: string | null
          created_at: string | null
          id: string
          locale: string
          metadata: Json | null
          public_layout_v2: Json | null
          slug: string
          status: string | null
          template_id: string | null
          title: string
          type: string
          updated_at: string
          video_duration: number | null
          video_resolution: string | null
          video_url: string | null
          visual_layout: Json | null
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          content_markdown?: string | null
          created_at?: string | null
          id?: string
          locale?: string
          metadata?: Json | null
          public_layout_v2?: Json | null
          slug: string
          status?: string | null
          template_id?: string | null
          title: string
          type: string
          updated_at?: string
          video_duration?: number | null
          video_resolution?: string | null
          video_url?: string | null
          visual_layout?: Json | null
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          content_markdown?: string | null
          created_at?: string | null
          id?: string
          locale?: string
          metadata?: Json | null
          public_layout_v2?: Json | null
          slug?: string
          status?: string | null
          template_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          video_duration?: number | null
          video_resolution?: string | null
          video_url?: string | null
          visual_layout?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_translation_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          result_summary: Json
          run_after: string
          source_content_id: string
          source_locale: string
          source_version: string
          started_at: string | null
          status: string
          target_locales: string[]
          updated_at: string
          worker_id: string | null
          workspace_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          result_summary?: Json
          run_after?: string
          source_content_id: string
          source_locale?: string
          source_version: string
          started_at?: string | null
          status?: string
          target_locales?: string[]
          updated_at?: string
          worker_id?: string | null
          workspace_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          result_summary?: Json
          run_after?: string
          source_content_id?: string
          source_locale?: string
          source_version?: string
          started_at?: string | null
          status?: string
          target_locales?: string[]
          updated_at?: string
          worker_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_translation_jobs_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_translation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_locations: {
        Row: {
          address: string | null
          client_id: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          address?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_locations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_link_graph: {
        Row: {
          anchor_text: string
          applied_at: string
          enhancement_run_id: string | null
          id: string
          source_content_id: string
          target_slug: string
          workspace_id: string
        }
        Insert: {
          anchor_text: string
          applied_at?: string
          enhancement_run_id?: string | null
          id?: string
          source_content_id: string
          target_slug: string
          workspace_id: string
        }
        Update: {
          anchor_text?: string
          applied_at?: string
          enhancement_run_id?: string | null
          id?: string
          source_content_id?: string
          target_slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_link_graph_enhancement_run_id_fkey"
            columns: ["enhancement_run_id"]
            isOneToOne: false
            referencedRelation: "blog_seo_enhancement_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_link_graph_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_link_graph_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreement_templates: {
        Row: {
          body_mdx: string
          category: Database["public"]["Enums"]["legal_template_category"]
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          jurisdiction: string
          locale: string
          name: string
          slug: string
          updated_at: string
          variables: Json
          version: number
          workspace_id: string | null
        }
        Insert: {
          body_mdx: string
          category: Database["public"]["Enums"]["legal_template_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          jurisdiction?: string
          locale?: string
          name: string
          slug: string
          updated_at?: string
          variables?: Json
          version?: number
          workspace_id?: string | null
        }
        Update: {
          body_mdx?: string
          category?: Database["public"]["Enums"]["legal_template_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          jurisdiction?: string
          locale?: string
          name?: string
          slug?: string
          updated_at?: string
          variables?: Json
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_agreement_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_agreements: {
        Row: {
          booking_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          effective_date: string | null
          expires_at: string | null
          id: string
          party_email: string
          party_name: string
          payload: Json
          public_token: string
          signed_at: string | null
          signed_sha256: string | null
          status: Database["public"]["Enums"]["legal_agreement_status"]
          template_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          party_email: string
          party_name: string
          payload?: Json
          public_token?: string
          signed_at?: string | null
          signed_sha256?: string | null
          status?: Database["public"]["Enums"]["legal_agreement_status"]
          template_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          expires_at?: string | null
          id?: string
          party_email?: string
          party_name?: string
          payload?: Json
          public_token?: string
          signed_at?: string | null
          signed_sha256?: string | null
          status?: Database["public"]["Enums"]["legal_agreement_status"]
          template_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_agreements_workspace_booking_fk"
            columns: ["workspace_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "legal_agreements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_agreements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_agreements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "legal_agreement_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_agreements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["legal_document_kind"]
          metadata: Json
          mime: string
          related_agreement_id: string | null
          related_entry_id: string | null
          retention_until: string
          sha256: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["legal_document_kind"]
          metadata?: Json
          mime: string
          related_agreement_id?: string | null
          related_entry_id?: string | null
          retention_until: string
          sha256: string
          size_bytes: number
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["legal_document_kind"]
          metadata?: Json
          mime?: string
          related_agreement_id?: string | null
          related_entry_id?: string | null
          retention_until?: string
          sha256?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_related_agreement_id_fkey"
            columns: ["related_agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_related_entry_id_fkey"
            columns: ["related_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_signature_events: {
        Row: {
          actor_email: string | null
          actor_ip: unknown
          actor_user_agent: string | null
          agreement_id: string
          event: Database["public"]["Enums"]["legal_signature_event_kind"]
          id: string
          metadata: Json
          occurred_at: string
          payload_sha256: string | null
          workspace_id: string
        }
        Insert: {
          actor_email?: string | null
          actor_ip?: unknown
          actor_user_agent?: string | null
          agreement_id: string
          event: Database["public"]["Enums"]["legal_signature_event_kind"]
          id?: string
          metadata?: Json
          occurred_at?: string
          payload_sha256?: string | null
          workspace_id: string
        }
        Update: {
          actor_email?: string | null
          actor_ip?: unknown
          actor_user_agent?: string | null
          agreement_id?: string
          event?: Database["public"]["Enums"]["legal_signature_event_kind"]
          id?: string
          metadata?: Json
          occurred_at?: string
          payload_sha256?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_signature_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "legal_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_signature_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignments: {
        Row: {
          assigned_by_profile_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          manager_profile_id: string
          starts_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_by_profile_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          manager_profile_id: string
          starts_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_by_profile_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          manager_profile_id?: string
          starts_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_assignments_assigned_by_profile_id_fkey"
            columns: ["assigned_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_audience_members: {
        Row: {
          audience_id: string
          contact_id: string
          created_at: string
          id: string
          metadata: Json
        }
        Insert: {
          audience_id: string
          contact_id: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          audience_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_audience_members_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "newsletter_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_audience_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "newsletter_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_audiences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          metadata: Json
          name: string
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          name: string
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          name?: string
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_automation_enrollments: {
        Row: {
          automation_id: string
          contact_id: string | null
          created_at: string
          current_step_position: number
          id: string
          last_error: string | null
          metadata: Json
          next_run_at: string | null
          source_content_id: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          contact_id?: string | null
          created_at?: string
          current_step_position?: number
          id?: string
          last_error?: string | null
          metadata?: Json
          next_run_at?: string | null
          source_content_id?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          contact_id?: string | null
          created_at?: string
          current_step_position?: number
          id?: string
          last_error?: string | null
          metadata?: Json
          next_run_at?: string | null
          source_content_id?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_automation_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "newsletter_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_automation_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "newsletter_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_automation_enrollments_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_automation_enrollments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_automation_steps: {
        Row: {
          automation_id: string
          body_markdown_override: string | null
          created_at: string
          delay_minutes: number
          id: string
          metadata: Json
          position: number
          preheader_override: string | null
          step_type: string
          subject_line_override: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          automation_id: string
          body_markdown_override?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          metadata?: Json
          position: number
          preheader_override?: string | null
          step_type: string
          subject_line_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          automation_id?: string
          body_markdown_override?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          metadata?: Json
          position?: number
          preheader_override?: string | null
          step_type?: string
          subject_line_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_automation_steps_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "newsletter_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_automation_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaign_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_automations: {
        Row: {
          audience_id: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
          status: string
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
          status?: string
          trigger_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audience_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
          status?: string
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_automations_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "newsletter_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_campaign_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          click_count: number
          clicked_at: string | null
          complained_at: string | null
          contact_id: string
          created_at: string
          delivered_at: string | null
          email: string
          id: string
          last_error: string | null
          metadata: Json
          open_count: number
          opened_at: string | null
          provider_message_id: string | null
          send_status: string
          sent_at: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          email: string
          id?: string
          last_error?: string | null
          metadata?: Json
          open_count?: number
          opened_at?: string | null
          provider_message_id?: string | null
          send_status?: string
          sent_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          email?: string
          id?: string
          last_error?: string | null
          metadata?: Json
          open_count?: number
          opened_at?: string | null
          provider_message_id?: string | null
          send_status?: string
          sent_at?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "newsletter_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_campaign_templates: {
        Row: {
          body_markdown_template: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          html_template: string | null
          id: string
          is_system: boolean
          metadata: Json
          name: string
          preheader_template: string | null
          slug: string
          subject_template: string
          updated_at: string
          workflow_type: string
          workspace_id: string
        }
        Insert: {
          body_markdown_template: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          html_template?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name: string
          preheader_template?: string | null
          slug: string
          subject_template: string
          updated_at?: string
          workflow_type?: string
          workspace_id: string
        }
        Update: {
          body_markdown_template?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          html_template?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name?: string
          preheader_template?: string | null
          slug?: string
          subject_template?: string
          updated_at?: string
          workflow_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaign_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_campaigns: {
        Row: {
          audience_id: string | null
          automation_id: string | null
          body_markdown: string
          created_at: string
          from_email: string | null
          from_name: string | null
          html_body: string | null
          id: string
          last_error: string | null
          metadata: Json
          preheader: string | null
          reply_to_email: string | null
          scheduled_for: string | null
          sent_at: string | null
          source_content_id: string | null
          status: string
          subject_line: string
          template_id: string | null
          title: string
          updated_at: string
          workflow_type: string
          workspace_id: string
        }
        Insert: {
          audience_id?: string | null
          automation_id?: string | null
          body_markdown: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          preheader?: string | null
          reply_to_email?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          source_content_id?: string | null
          status?: string
          subject_line: string
          template_id?: string | null
          title: string
          updated_at?: string
          workflow_type?: string
          workspace_id: string
        }
        Update: {
          audience_id?: string | null
          automation_id?: string | null
          body_markdown?: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          html_body?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json
          preheader?: string | null
          reply_to_email?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          source_content_id?: string | null
          status?: string
          subject_line?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workflow_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaigns_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "newsletter_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_campaigns_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "newsletter_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_campaigns_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaign_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_contacts: {
        Row: {
          bounced_at: string | null
          complained_at: string | null
          created_at: string
          email: string
          email_normalized: string
          first_name: string | null
          id: string
          last_name: string | null
          locale: string | null
          metadata: Json
          resend_contact_id: string | null
          source: string
          status: string
          subscribed_at: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          verification_token: string | null
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          bounced_at?: string | null
          complained_at?: string | null
          created_at?: string
          email: string
          email_normalized: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string | null
          metadata?: Json
          resend_contact_id?: string | null
          source?: string
          status?: string
          subscribed_at?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          bounced_at?: string | null
          complained_at?: string | null
          created_at?: string
          email?: string
          email_normalized?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string | null
          metadata?: Json
          resend_contact_id?: string | null
          source?: string
          status?: string
          subscribed_at?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_dispatch_jobs: {
        Row: {
          attempts: number
          automation_enrollment_id: string | null
          campaign_id: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          metadata: Json
          run_at: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          automation_enrollment_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          metadata?: Json
          run_at?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          automation_enrollment_id?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          metadata?: Json
          run_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_dispatch_jobs_automation_enrollment_id_fkey"
            columns: ["automation_enrollment_id"]
            isOneToOne: false
            referencedRelation: "newsletter_automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_dispatch_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_dispatch_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          subscribed_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          subscribed_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          subscribed_at?: string
        }
        Relationships: []
      }
      newsletter_unlock_consumptions: {
        Row: {
          consumed_at: string
          grant_id: string
          id: string
          tool: string
        }
        Insert: {
          consumed_at?: string
          grant_id: string
          id?: string
          tool: string
        }
        Update: {
          consumed_at?: string
          grant_id?: string
          id?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_unlock_consumptions_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "newsletter_unlock_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_unlock_grants: {
        Row: {
          email_normalized: string
          expires_at: string
          granted_at: string
          id: string
          revoked_at: string | null
          source: string
          unlock_token: string
          workspace_id: string | null
        }
        Insert: {
          email_normalized: string
          expires_at: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          source?: string
          unlock_token: string
          workspace_id?: string | null
        }
        Update: {
          email_normalized?: string
          expires_at?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          source?: string
          unlock_token?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_unlock_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          provider_event_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          booking_payment_id: string | null
          created_at: string
          delivery_attempt: number
          headers_json: Json
          id: string
          metadata: Json
          payload_json: Json
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          provider: string
          provider_event_id: string
          provider_event_type: string
          raw_body_sha256: string | null
          received_at: string
          reservation_id: string | null
          resource_json: Json
          updated_at: string
          verification_mode: string
          verification_status: string
          workspace_id: string | null
        }
        Insert: {
          booking_payment_id?: string | null
          created_at?: string
          delivery_attempt?: number
          headers_json?: Json
          id?: string
          metadata?: Json
          payload_json?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider: string
          provider_event_id: string
          provider_event_type: string
          raw_body_sha256?: string | null
          received_at?: string
          reservation_id?: string | null
          resource_json?: Json
          updated_at?: string
          verification_mode?: string
          verification_status?: string
          workspace_id?: string | null
        }
        Update: {
          booking_payment_id?: string | null
          created_at?: string
          delivery_attempt?: number
          headers_json?: Json
          id?: string
          metadata?: Json
          payload_json?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider?: string
          provider_event_id?: string
          provider_event_type?: string
          raw_body_sha256?: string | null
          received_at?: string
          reservation_id?: string | null
          resource_json?: Json
          updated_at?: string
          verification_mode?: string
          verification_status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_workspace_payment_fk"
            columns: ["workspace_id", "booking_payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "payment_webhook_events_workspace_reservation_fk"
            columns: ["workspace_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "booking_reservations"
            referencedColumns: ["workspace_id", "id"]
          },
          {
            foreignKeyName: "payment_webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_portal_announcements: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_published: boolean
          published_at: string
          title: string
          tone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string
          title: string
          tone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string
          title?: string
          tone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_portal_announcements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episode_music: {
        Row: {
          created_at: string
          episode_id: string
          fade_in_ms: number
          fade_out_ms: number
          gain_db: number
          id: string
          role: string
          start_offset_ms: number
          track_id: string
        }
        Insert: {
          created_at?: string
          episode_id: string
          fade_in_ms?: number
          fade_out_ms?: number
          gain_db?: number
          id?: string
          role: string
          start_offset_ms?: number
          track_id: string
        }
        Update: {
          created_at?: string
          episode_id?: string
          fade_in_ms?: number
          fade_out_ms?: number
          gain_db?: number
          id?: string
          role?: string
          start_offset_ms?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episode_music_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episode_music_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "workspace_music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_episodes: {
        Row: {
          audio_byte_size: number | null
          audio_duration_seconds: number | null
          audio_mime_type: string
          audio_url: string | null
          chapters: Json
          content_item_id: string | null
          cover_art_url: string | null
          created_at: string
          description: string | null
          episode_number: number | null
          episode_type: string
          generation_metadata: Json
          guest_voice_id: string | null
          host_voice_id: string | null
          id: string
          locale: string
          metadata: Json
          narration_only_url: string | null
          published_at: string | null
          scheduled_for: string | null
          season_number: number | null
          show_id: string
          slug: string
          status: string
          summary: string | null
          template_id: string | null
          title: string
          transcript_text: string | null
          transcript_vtt_url: string | null
          updated_at: string
          voice_id: string | null
          workspace_id: string
        }
        Insert: {
          audio_byte_size?: number | null
          audio_duration_seconds?: number | null
          audio_mime_type?: string
          audio_url?: string | null
          chapters?: Json
          content_item_id?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          episode_type?: string
          generation_metadata?: Json
          guest_voice_id?: string | null
          host_voice_id?: string | null
          id?: string
          locale?: string
          metadata?: Json
          narration_only_url?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          season_number?: number | null
          show_id: string
          slug: string
          status?: string
          summary?: string | null
          template_id?: string | null
          title: string
          transcript_text?: string | null
          transcript_vtt_url?: string | null
          updated_at?: string
          voice_id?: string | null
          workspace_id: string
        }
        Update: {
          audio_byte_size?: number | null
          audio_duration_seconds?: number | null
          audio_mime_type?: string
          audio_url?: string | null
          chapters?: Json
          content_item_id?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          episode_number?: number | null
          episode_type?: string
          generation_metadata?: Json
          guest_voice_id?: string | null
          host_voice_id?: string | null
          id?: string
          locale?: string
          metadata?: Json
          narration_only_url?: string | null
          published_at?: string | null
          scheduled_for?: string | null
          season_number?: number | null
          show_id?: string
          slug?: string
          status?: string
          summary?: string | null
          template_id?: string | null
          title?: string
          transcript_text?: string | null
          transcript_vtt_url?: string | null
          updated_at?: string
          voice_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_guest_voice_id_fkey"
            columns: ["guest_voice_id"]
            isOneToOne: false
            referencedRelation: "workspace_voices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_host_voice_id_fkey"
            columns: ["host_voice_id"]
            isOneToOne: false
            referencedRelation: "workspace_voices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "podcast_shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "podcast_episodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_shows: {
        Row: {
          author: string | null
          category: string | null
          cover_art_url: string | null
          created_at: string
          description: string | null
          explicit: boolean
          feed_url: string | null
          id: string
          is_published: boolean
          language: string
          metadata: Json
          owner_email: string | null
          slug: string
          subtitle: string | null
          template_id: string | null
          title: string
          updated_at: string
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          explicit?: boolean
          feed_url?: string | null
          id?: string
          is_published?: boolean
          language?: string
          metadata?: Json
          owner_email?: string | null
          slug: string
          subtitle?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          author?: string | null
          category?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          explicit?: boolean
          feed_url?: string | null
          id?: string
          is_published?: boolean
          language?: string
          metadata?: Json
          owner_email?: string | null
          slug?: string
          subtitle?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_shows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          role: string | null
          role_title: string | null
          social_links: Json
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          id: string
          role?: string | null
          role_title?: string | null
          social_links?: Json
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          role?: string | null
          role_title?: string | null
          social_links?: Json
        }
        Relationships: []
      }
      role_capability_grants: {
        Row: {
          capability_id: string
          created_at: string
          is_allowed: boolean
          role: string
          updated_at: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          is_allowed?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          is_allowed?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_capability_grants_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_content_opportunities: {
        Row: {
          analytics_score: number
          analytics_snapshot: Json
          blue_ocean_score: number
          cluster_id: string | null
          cluster_name: string | null
          created_at: string
          draft_content_item_id: string | null
          funnel_stage: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id: string
          inventory_snapshot: Json
          locale: string
          metadata: Json
          opportunity_type: Database["public"]["Enums"]["seo_opportunity_type"]
          plan_id: string | null
          priority_score: number
          rationale: string | null
          recommended_format: string | null
          run_id: string | null
          status: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score: number
          summary: string | null
          target_conversion_goal: string | null
          target_intent: string | null
          title: string
          topic: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analytics_score?: number
          analytics_snapshot?: Json
          blue_ocean_score?: number
          cluster_id?: string | null
          cluster_name?: string | null
          created_at?: string
          draft_content_item_id?: string | null
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          inventory_snapshot?: Json
          locale?: string
          metadata?: Json
          opportunity_type: Database["public"]["Enums"]["seo_opportunity_type"]
          plan_id?: string | null
          priority_score?: number
          rationale?: string | null
          recommended_format?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score?: number
          summary?: string | null
          target_conversion_goal?: string | null
          target_intent?: string | null
          title: string
          topic: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analytics_score?: number
          analytics_snapshot?: Json
          blue_ocean_score?: number
          cluster_id?: string | null
          cluster_name?: string | null
          created_at?: string
          draft_content_item_id?: string | null
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          inventory_snapshot?: Json
          locale?: string
          metadata?: Json
          opportunity_type?: Database["public"]["Enums"]["seo_opportunity_type"]
          plan_id?: string | null
          priority_score?: number
          rationale?: string | null
          recommended_format?: string | null
          run_id?: string | null
          status?: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score?: number
          summary?: string | null
          target_conversion_goal?: string | null
          target_intent?: string | null
          title?: string
          topic?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_content_opportunities_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "seo_topic_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_opportunities_draft_content_item_id_fkey"
            columns: ["draft_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_opportunities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "seo_content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_opportunities_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_recommendation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_content_plans: {
        Row: {
          brief_markdown: string | null
          cluster_id: string | null
          created_at: string
          draft_content_item_id: string | null
          funnel_stage: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id: string
          intent_stage: string | null
          locale: string
          metadata: Json
          outline: Json
          primary_keyword: string | null
          priority_score: number
          run_id: string | null
          secondary_keywords: Json
          slug_suggestion: string | null
          status: Database["public"]["Enums"]["seo_plan_status"]
          target_conversion_goal: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brief_markdown?: string | null
          cluster_id?: string | null
          created_at?: string
          draft_content_item_id?: string | null
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          intent_stage?: string | null
          locale?: string
          metadata?: Json
          outline?: Json
          primary_keyword?: string | null
          priority_score?: number
          run_id?: string | null
          secondary_keywords?: Json
          slug_suggestion?: string | null
          status?: Database["public"]["Enums"]["seo_plan_status"]
          target_conversion_goal?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brief_markdown?: string | null
          cluster_id?: string | null
          created_at?: string
          draft_content_item_id?: string | null
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          intent_stage?: string | null
          locale?: string
          metadata?: Json
          outline?: Json
          primary_keyword?: string | null
          priority_score?: number
          run_id?: string | null
          secondary_keywords?: Json
          slug_suggestion?: string | null
          status?: Database["public"]["Enums"]["seo_plan_status"]
          target_conversion_goal?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_content_plans_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "seo_topic_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_plans_draft_content_item_id_fkey"
            columns: ["draft_content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_plans_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_recommendation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_content_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_execution_events: {
        Row: {
          applied_at: string | null
          applied_by_profile_id: string | null
          block_id: string | null
          content_field_mutated: string
          content_format: string
          created_at: string
          error_message: string | null
          execution_status: Database["public"]["Enums"]["seo_execution_status"]
          field_path: string | null
          id: string
          locale: string | null
          mutation_strategy: string
          original_content_snapshot: string
          original_field_value: string | null
          preview_payload: Json
          recommendation_id: string
          renderer: string
          risk_checks: Json
          rollback_at: string | null
          rollback_status: Database["public"]["Enums"]["seo_rollback_status"]
          rolled_back_by_profile_id: string | null
          source_content_id: string
          source_slug: string | null
          target_content_id: string
          target_slug: string | null
          updated_at: string
          updated_content_snapshot: string | null
          updated_field_value: string | null
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          applied_by_profile_id?: string | null
          block_id?: string | null
          content_field_mutated?: string
          content_format: string
          created_at?: string
          error_message?: string | null
          execution_status?: Database["public"]["Enums"]["seo_execution_status"]
          field_path?: string | null
          id?: string
          locale?: string | null
          mutation_strategy: string
          original_content_snapshot: string
          original_field_value?: string | null
          preview_payload?: Json
          recommendation_id: string
          renderer: string
          risk_checks?: Json
          rollback_at?: string | null
          rollback_status?: Database["public"]["Enums"]["seo_rollback_status"]
          rolled_back_by_profile_id?: string | null
          source_content_id: string
          source_slug?: string | null
          target_content_id: string
          target_slug?: string | null
          updated_at?: string
          updated_content_snapshot?: string | null
          updated_field_value?: string | null
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          applied_by_profile_id?: string | null
          block_id?: string | null
          content_field_mutated?: string
          content_format?: string
          created_at?: string
          error_message?: string | null
          execution_status?: Database["public"]["Enums"]["seo_execution_status"]
          field_path?: string | null
          id?: string
          locale?: string | null
          mutation_strategy?: string
          original_content_snapshot?: string
          original_field_value?: string | null
          preview_payload?: Json
          recommendation_id?: string
          renderer?: string
          risk_checks?: Json
          rollback_at?: string | null
          rollback_status?: Database["public"]["Enums"]["seo_rollback_status"]
          rolled_back_by_profile_id?: string | null
          source_content_id?: string
          source_slug?: string | null
          target_content_id?: string
          target_slug?: string | null
          updated_at?: string
          updated_content_snapshot?: string | null
          updated_field_value?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_execution_events_applied_by_profile_id_fkey"
            columns: ["applied_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_execution_events_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "seo_internal_link_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_execution_events_rolled_back_by_profile_id_fkey"
            columns: ["rolled_back_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_execution_events_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_execution_events_target_content_id_fkey"
            columns: ["target_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_execution_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_internal_link_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          content_hash: string
          content_id: string
          cost_summary_millicents: number
          created_at: string
          error_message: string | null
          id: string
          locale: string
          locked_at: string | null
          model_config_snapshot: Json
          run_after: string
          status: string
          summary: Json
          template_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          content_hash: string
          content_id: string
          cost_summary_millicents?: number
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: string
          locked_at?: string | null
          model_config_snapshot?: Json
          run_after?: string
          status?: string
          summary?: Json
          template_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          content_hash?: string
          content_id?: string
          cost_summary_millicents?: number
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: string
          locked_at?: string | null
          model_config_snapshot?: Json
          run_after?: string
          status?: string
          summary?: Json
          template_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_internal_link_jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_internal_link_opportunities: {
        Row: {
          analytics_score: number
          anchor_text: string
          applied_at: string | null
          applied_by_profile_id: string | null
          approved_at: string | null
          confidence_score: number
          created_at: string
          dismissed_at: string | null
          existing_link_count: number
          failed_at: string | null
          failed_reason: string | null
          id: string
          is_orphan_target: boolean
          last_execution_event_id: string | null
          last_preview_at: string | null
          last_preview_payload: Json
          locale: string
          manual_review_reason: string | null
          metadata: Json
          priority_score: number
          rationale: string | null
          rolled_back_at: string | null
          run_id: string | null
          semantic_fit_score: number
          source_content_id: string
          source_excerpt: string | null
          source_slug: string | null
          source_title: string
          source_traffic: number
          status: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score: number
          suggestion: Json
          target_content_id: string
          target_conversion_goal: string | null
          target_conversions: number
          target_excerpt: string | null
          target_slug: string | null
          target_title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analytics_score?: number
          anchor_text: string
          applied_at?: string | null
          applied_by_profile_id?: string | null
          approved_at?: string | null
          confidence_score?: number
          created_at?: string
          dismissed_at?: string | null
          existing_link_count?: number
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          is_orphan_target?: boolean
          last_execution_event_id?: string | null
          last_preview_at?: string | null
          last_preview_payload?: Json
          locale?: string
          manual_review_reason?: string | null
          metadata?: Json
          priority_score?: number
          rationale?: string | null
          rolled_back_at?: string | null
          run_id?: string | null
          semantic_fit_score?: number
          source_content_id: string
          source_excerpt?: string | null
          source_slug?: string | null
          source_title: string
          source_traffic?: number
          status?: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score?: number
          suggestion?: Json
          target_content_id: string
          target_conversion_goal?: string | null
          target_conversions?: number
          target_excerpt?: string | null
          target_slug?: string | null
          target_title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analytics_score?: number
          anchor_text?: string
          applied_at?: string | null
          applied_by_profile_id?: string | null
          approved_at?: string | null
          confidence_score?: number
          created_at?: string
          dismissed_at?: string | null
          existing_link_count?: number
          failed_at?: string | null
          failed_reason?: string | null
          id?: string
          is_orphan_target?: boolean
          last_execution_event_id?: string | null
          last_preview_at?: string | null
          last_preview_payload?: Json
          locale?: string
          manual_review_reason?: string | null
          metadata?: Json
          priority_score?: number
          rationale?: string | null
          rolled_back_at?: string | null
          run_id?: string | null
          semantic_fit_score?: number
          source_content_id?: string
          source_excerpt?: string | null
          source_slug?: string | null
          source_title?: string
          source_traffic?: number
          status?: Database["public"]["Enums"]["seo_recommendation_status"]
          strategic_importance_score?: number
          suggestion?: Json
          target_content_id?: string
          target_conversion_goal?: string | null
          target_conversions?: number
          target_excerpt?: string | null
          target_slug?: string | null
          target_title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_internal_link_opportunities_applied_by_profile_id_fkey"
            columns: ["applied_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_opportunities_last_execution_event_id_fkey"
            columns: ["last_execution_event_id"]
            isOneToOne: false
            referencedRelation: "seo_execution_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_opportunities_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_recommendation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_opportunities_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_opportunities_target_content_id_fkey"
            columns: ["target_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_internal_link_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_recommendation_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          locale: string
          run_type: Database["public"]["Enums"]["seo_run_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["seo_run_status"]
          summary: Json
          totals: Json
          triggered_by_profile_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: string
          run_type: Database["public"]["Enums"]["seo_run_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["seo_run_status"]
          summary?: Json
          totals?: Json
          triggered_by_profile_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: string
          run_type?: Database["public"]["Enums"]["seo_run_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["seo_run_status"]
          summary?: Json
          totals?: Json
          triggered_by_profile_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_recommendation_runs_triggered_by_profile_id_fkey"
            columns: ["triggered_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_recommendation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_topic_clusters: {
        Row: {
          created_at: string
          funnel_stage: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id: string
          locale: string
          metadata: Json
          name: string
          pillar_topic: string | null
          primary_intent: string | null
          priority_score: number
          run_id: string | null
          status: Database["public"]["Enums"]["seo_plan_status"]
          summary: string | null
          supporting_topics: Json
          target_conversion_goal: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          locale?: string
          metadata?: Json
          name: string
          pillar_topic?: string | null
          primary_intent?: string | null
          priority_score?: number
          run_id?: string | null
          status?: Database["public"]["Enums"]["seo_plan_status"]
          summary?: string | null
          supporting_topics?: Json
          target_conversion_goal?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          funnel_stage?: Database["public"]["Enums"]["seo_funnel_stage"] | null
          id?: string
          locale?: string
          metadata?: Json
          name?: string
          pillar_topic?: string | null
          primary_intent?: string | null
          priority_score?: number
          run_id?: string | null
          status?: Database["public"]["Enums"]["seo_plan_status"]
          summary?: string | null
          supporting_topics?: Json
          target_conversion_goal?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_topic_clusters_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "seo_recommendation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_topic_clusters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      theme_catalog: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          theme_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          theme_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          theme_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      theme_versions: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          released_at: string | null
          status: string
          theme_id: string
          updated_at: string
          version: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          released_at?: string | null
          status?: string
          theme_id: string
          updated_at?: string
          version: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          released_at?: string | null
          status?: string
          theme_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_versions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "theme_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_hash: string | null
          locale: string | null
          payload: Json
          referrer: string | null
          result: Json
          share_token: string | null
          tool_slug: string
          user_agent_hash: string | null
          utm: Json | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string | null
          payload?: Json
          referrer?: string | null
          result?: Json
          share_token?: string | null
          tool_slug: string
          user_agent_hash?: string | null
          utm?: Json | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string | null
          payload?: Json
          referrer?: string | null
          result?: Json
          share_token?: string | null
          tool_slug?: string
          user_agent_hash?: string | null
          utm?: Json | null
        }
        Relationships: []
      }
      tool_rate_limits: {
        Row: {
          bucket: string
          count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      tool_scan_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          id: string
          result: Json
          tool_slug: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          id?: string
          result: Json
          tool_slug: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          result?: Json
          tool_slug?: string
        }
        Relationships: []
      }
      video_render_jobs: {
        Row: {
          content_id: string | null
          created_at: string
          id: string
          result_video_url: string | null
          status: string
          storage_path: string
          workspace_id: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          id?: string
          result_video_url?: string | null
          status?: string
          storage_path: string
          workspace_id: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          id?: string
          result_video_url?: string | null
          status?: string
          storage_path?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_render_jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_render_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_consent_audits: {
        Row: {
          actor_profile_id: string | null
          consent_text: string | null
          created_at: string
          event: string
          id: string
          ip_hash: string | null
          metadata: Json
          user_agent: string | null
          voice_id: string
          workspace_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          consent_text?: string | null
          created_at?: string
          event: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          voice_id: string
          workspace_id: string
        }
        Update: {
          actor_profile_id?: string | null
          consent_text?: string | null
          created_at?: string
          event?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json
          user_agent?: string | null
          voice_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_consent_audits_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "workspace_voices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_consent_audits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_capability_overrides: {
        Row: {
          capability_id: string
          created_at: string
          is_allowed: boolean
          reason: string | null
          updated_at: string
          updated_by_profile_id: string | null
          workspace_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          is_allowed: boolean
          reason?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
          workspace_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          is_allowed?: boolean
          reason?: string | null
          updated_at?: string
          updated_by_profile_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_capability_overrides_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_capability_overrides_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_capability_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_case_snippets: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          is_active: boolean
          last_used_at: string | null
          outcome_summary: string | null
          tags: string[]
          title: string
          updated_at: string
          use_count: number
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_used_at?: string | null
          outcome_summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          use_count?: number
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          last_used_at?: string | null
          outcome_summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          use_count?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_case_snippets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_gdpr_requests: {
        Row: {
          completed_at: string | null
          completed_by_profile_id: string | null
          created_at: string
          due_at: string
          evidence: Json
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          status: string
          subject_email: string
          subject_name: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_profile_id?: string | null
          created_at?: string
          due_at?: string
          evidence?: Json
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          status?: string
          subject_email: string
          subject_name?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by_profile_id?: string | null
          created_at?: string
          due_at?: string
          evidence?: Json
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          status?: string
          subject_email?: string
          subject_name?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_gdpr_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_gdpr_settings: {
        Row: {
          analytics_retention_days: number
          consent_required: boolean
          cookie_consent_mode: string
          created_at: string
          data_regions: string[]
          dpo_email: string | null
          dpo_name: string | null
          logs_retention_days: number
          marketing_retention_days: number
          notes: string | null
          privacy_policy_url: string | null
          processing_legal_basis: string
          sub_processors: Json
          terms_url: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          analytics_retention_days?: number
          consent_required?: boolean
          cookie_consent_mode?: string
          created_at?: string
          data_regions?: string[]
          dpo_email?: string | null
          dpo_name?: string | null
          logs_retention_days?: number
          marketing_retention_days?: number
          notes?: string | null
          privacy_policy_url?: string | null
          processing_legal_basis?: string
          sub_processors?: Json
          terms_url?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          analytics_retention_days?: number
          consent_required?: boolean
          cookie_consent_mode?: string
          created_at?: string
          data_regions?: string[]
          dpo_email?: string | null
          dpo_name?: string | null
          logs_retention_days?: number
          marketing_retention_days?: number
          notes?: string | null
          privacy_policy_url?: string | null
          processing_legal_basis?: string
          sub_processors?: Json
          terms_url?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_gdpr_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_learned_authority_domains: {
        Row: {
          cite_count: number
          domain: string
          first_cited_at: string
          last_cited_at: string
          workspace_id: string
        }
        Insert: {
          cite_count?: number
          domain: string
          first_cited_at?: string
          last_cited_at?: string
          workspace_id: string
        }
        Update: {
          cite_count?: number
          domain?: string
          first_cited_at?: string
          last_cited_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_learned_authority_domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_market_monitor_config: {
        Row: {
          authority_domains: string[]
          competitor_domains: string[]
          created_at: string
          enabled: boolean
          id: string
          industry_keywords: string[]
          last_run_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          authority_domains?: string[]
          competitor_domains?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          industry_keywords?: string[]
          last_run_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          authority_domains?: string[]
          competitor_domains?: string[]
          created_at?: string
          enabled?: boolean
          id?: string
          industry_keywords?: string[]
          last_run_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_market_monitor_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_market_monitor_results: {
        Row: {
          archived: boolean
          archived_at: string | null
          canonical_url: string | null
          change_type: string
          config_id: string
          detected_at: string
          id: string
          published_date: string | null
          read: boolean
          snippet: string | null
          title: string | null
          trust_tier: number
          url: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          canonical_url?: string | null
          change_type: string
          config_id: string
          detected_at?: string
          id?: string
          published_date?: string | null
          read?: boolean
          snippet?: string | null
          title?: string | null
          trust_tier?: number
          url: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          canonical_url?: string | null
          change_type?: string
          config_id?: string
          detected_at?: string
          id?: string
          published_date?: string | null
          read?: boolean
          snippet?: string | null
          title?: string | null
          trust_tier?: number
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_market_monitor_results_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "workspace_market_monitor_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_market_monitor_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          membership_role: string
          onboarding_completed_at: string | null
          onboarding_skipped_at: string | null
          onboarding_state: Json
          profile_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          membership_role?: string
          onboarding_completed_at?: string | null
          onboarding_skipped_at?: string | null
          onboarding_state?: Json
          profile_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          membership_role?: string
          onboarding_completed_at?: string | null
          onboarding_skipped_at?: string | null
          onboarding_state?: Json
          profile_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_music_tracks: {
        Row: {
          archived_at: string | null
          audio_byte_size: number | null
          audio_mime_type: string
          cost_millicents: number
          created_at: string
          created_by_profile_id: string | null
          duration_seconds: number
          generator_model: string | null
          id: string
          is_bed: boolean
          is_intro: boolean
          is_outro: boolean
          loop_safe: boolean
          metadata: Json
          mood: string
          prompt_text: string | null
          source: string
          storage_path: string
          template_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          audio_byte_size?: number | null
          audio_mime_type?: string
          cost_millicents?: number
          created_at?: string
          created_by_profile_id?: string | null
          duration_seconds?: number
          generator_model?: string | null
          id?: string
          is_bed?: boolean
          is_intro?: boolean
          is_outro?: boolean
          loop_safe?: boolean
          metadata?: Json
          mood: string
          prompt_text?: string | null
          source?: string
          storage_path: string
          template_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          audio_byte_size?: number | null
          audio_mime_type?: string
          cost_millicents?: number
          created_at?: string
          created_by_profile_id?: string | null
          duration_seconds?: number
          generator_model?: string | null
          id?: string
          is_bed?: boolean
          is_intro?: boolean
          is_outro?: boolean
          loop_safe?: boolean
          metadata?: Json
          mood?: string
          prompt_text?: string | null
          source?: string
          storage_path?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_music_tracks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_notes: {
        Row: {
          archived: boolean
          archived_at: string | null
          body: string
          created_at: string
          id: string
          profile_id: string
          source_metadata: Json | null
          source_type: string | null
          source_voice_memo_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          body?: string
          created_at?: string
          id?: string
          profile_id: string
          source_metadata?: Json | null
          source_type?: string | null
          source_voice_memo_id?: string | null
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
          source_metadata?: Json | null
          source_type?: string | null
          source_voice_memo_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_notes_source_voice_memo_scope_fkey"
            columns: ["source_voice_memo_id", "workspace_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "workspace_voice_memos"
            referencedColumns: ["id", "workspace_id", "profile_id"]
          },
          {
            foreignKeyName: "workspace_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_opportunities: {
        Row: {
          category: Database["public"]["Enums"]["workspace_opportunity_category"]
          created_at: string
          id: string
          priority_score: number
          recommendation_markdown: string | null
          resolved_at: string | null
          resolved_by_profile_id: string | null
          scan_id: string | null
          severity: Database["public"]["Enums"]["workspace_opportunity_severity"]
          signal_data: Json
          signal_key: string
          status: Database["public"]["Enums"]["workspace_opportunity_status"]
          summary: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["workspace_opportunity_category"]
          created_at?: string
          id?: string
          priority_score?: number
          recommendation_markdown?: string | null
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          scan_id?: string | null
          severity?: Database["public"]["Enums"]["workspace_opportunity_severity"]
          signal_data?: Json
          signal_key: string
          status?: Database["public"]["Enums"]["workspace_opportunity_status"]
          summary?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["workspace_opportunity_category"]
          created_at?: string
          id?: string
          priority_score?: number
          recommendation_markdown?: string | null
          resolved_at?: string | null
          resolved_by_profile_id?: string | null
          scan_id?: string | null
          severity?: Database["public"]["Enums"]["workspace_opportunity_severity"]
          signal_data?: Json
          signal_key?: string
          status?: Database["public"]["Enums"]["workspace_opportunity_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_opportunities_resolved_by_profile_id_fkey"
            columns: ["resolved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_opportunities_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "workspace_opportunity_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_opportunity_scans: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          signals_found: number
          started_at: string | null
          status: Database["public"]["Enums"]["workspace_opportunity_scan_status"]
          triggered_by_profile_id: string | null
          triggered_via: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          signals_found?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["workspace_opportunity_scan_status"]
          triggered_by_profile_id?: string | null
          triggered_via?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          signals_found?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["workspace_opportunity_scan_status"]
          triggered_by_profile_id?: string | null
          triggered_via?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_opportunity_scans_triggered_by_profile_id_fkey"
            columns: ["triggered_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_opportunity_scans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_popup_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          locale: string | null
          metadata: Json
          path: string | null
          popup_id: string
          session_id: string | null
          visitor_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          locale?: string | null
          metadata?: Json
          path?: string | null
          popup_id: string
          session_id?: string | null
          visitor_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          locale?: string | null
          metadata?: Json
          path?: string | null
          popup_id?: string
          session_id?: string | null
          visitor_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_popup_events_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "workspace_popups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_popup_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_popups: {
        Row: {
          audience: Json
          content: Json
          created_at: string
          created_by_profile_id: string | null
          dismissal_ttl_seconds: number
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          starts_at: string | null
          template_kind: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience?: Json
          content: Json
          created_at?: string
          created_by_profile_id?: string | null
          dismissal_ttl_seconds?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          starts_at?: string | null
          template_kind: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audience?: Json
          content?: Json
          created_at?: string
          created_by_profile_id?: string | null
          dismissal_ttl_seconds?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          starts_at?: string | null
          template_kind?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_popups_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_popups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          locale_override: string | null
          metadata: Json
          site_description: string | null
          site_domain: string | null
          site_name: string | null
          template_override: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          locale_override?: string | null
          metadata?: Json
          site_description?: string | null
          site_domain?: string | null
          site_name?: string | null
          template_override?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          locale_override?: string | null
          metadata?: Json
          site_description?: string | null
          site_domain?: string | null
          site_name?: string | null
          template_override?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_theme_bindings: {
        Row: {
          bound_by_profile_id: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          theme_version_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bound_by_profile_id?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          theme_version_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bound_by_profile_id?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          theme_version_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_theme_bindings_bound_by_profile_id_fkey"
            columns: ["bound_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_theme_bindings_theme_version_id_fkey"
            columns: ["theme_version_id"]
            isOneToOne: false
            referencedRelation: "theme_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_theme_bindings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_voice_memos: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          attempt_count: number
          last_attempted_at: string | null
          mime_type: string
          next_retry_at: string | null
          processed_at: string | null
          processing_error: string | null
          processing_status: string | null
          profile_id: string
          storage_path: string
          summary_json: Json | null
          target_project_id: string | null
          title: string
          transcript: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          attempt_count?: number
          last_attempted_at?: string | null
          mime_type?: string
          next_retry_at?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          profile_id: string
          storage_path: string
          summary_json?: Json | null
          target_project_id?: string | null
          title?: string
          transcript?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          attempt_count?: number
          last_attempted_at?: string | null
          mime_type?: string
          next_retry_at?: string | null
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string | null
          profile_id?: string
          storage_path?: string
          summary_json?: Json | null
          target_project_id?: string | null
          title?: string
          transcript?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_voice_memos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_voices: {
        Row: {
          archived_at: string | null
          consent_actor_name: string | null
          consent_captured_at: string | null
          consent_source: string | null
          consent_status: string
          created_at: string
          created_by_profile_id: string | null
          display_name: string
          id: string
          language_code: string
          model_preference: string | null
          provider: string
          provider_metadata: Json
          provider_status: string
          provider_voice_id: string
          sample_retention_policy: string
          template_id: string | null
          updated_at: string
          voice_type: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          consent_actor_name?: string | null
          consent_captured_at?: string | null
          consent_source?: string | null
          consent_status?: string
          created_at?: string
          created_by_profile_id?: string | null
          display_name: string
          id?: string
          language_code?: string
          model_preference?: string | null
          provider: string
          provider_metadata?: Json
          provider_status?: string
          provider_voice_id: string
          sample_retention_policy?: string
          template_id?: string | null
          updated_at?: string
          voice_type: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          consent_actor_name?: string | null
          consent_captured_at?: string | null
          consent_source?: string | null
          consent_status?: string
          created_at?: string
          created_by_profile_id?: string | null
          display_name?: string
          id?: string
          language_code?: string
          model_preference?: string | null
          provider?: string
          provider_metadata?: Json
          provider_status?: string
          provider_voice_id?: string
          sample_retention_policy?: string
          template_id?: string | null
          updated_at?: string
          voice_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_voices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_campaigns: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          goal: string
          id: string
          metadata: Json
          name: string
          status: string
          target_geographies: string[]
          target_persona: string | null
          template_id: string | null
          updated_at: string
          utm_campaign: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          goal: string
          id?: string
          metadata?: Json
          name: string
          status?: string
          target_geographies?: string[]
          target_persona?: string | null
          template_id?: string | null
          updated_at?: string
          utm_campaign: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          goal?: string
          id?: string
          metadata?: Json
          name?: string
          status?: string
          target_geographies?: string[]
          target_persona?: string | null
          template_id?: string | null
          updated_at?: string
          utm_campaign?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_campaigns_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_packages: {
        Row: {
          approved_at: string | null
          approved_by_profile_id: string | null
          backlink_safety_score: number
          body_markdown: string | null
          body_plaintext: string | null
          body_platform_specific: string | null
          campaign_id: string | null
          compliance_warnings: Json
          copy_blocks: Json
          created_at: string
          evidence_pack: Json
          exported_at: string | null
          generated_by_profile_id: string | null
          gsc_snapshot: Json
          id: string
          link_plan: Json
          locale: string
          manual_published_at: string | null
          manual_published_url: string | null
          metadata: Json
          platform: Database["public"]["Enums"]["external_publication_platform"]
          primary_query: string | null
          quality_score: number
          source_content_id: string | null
          source_seo_opportunity_id: string | null
          source_seo_plan_id: string | null
          source_type: Database["public"]["Enums"]["external_publication_source_type"]
          status: Database["public"]["Enums"]["external_publication_status"]
          target_slug: string | null
          target_url: string
          template_id: string | null
          title_options: Json
          topic: string
          updated_at: string
          usefulness_score: number
          utm_campaign: string
          utm_content: string
          utm_medium: string
          utm_source: string
          validation_result: Json
          visual_plan: Json
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          backlink_safety_score?: number
          body_markdown?: string | null
          body_plaintext?: string | null
          body_platform_specific?: string | null
          campaign_id?: string | null
          compliance_warnings?: Json
          copy_blocks?: Json
          created_at?: string
          evidence_pack?: Json
          exported_at?: string | null
          generated_by_profile_id?: string | null
          gsc_snapshot?: Json
          id?: string
          link_plan?: Json
          locale?: string
          manual_published_at?: string | null
          manual_published_url?: string | null
          metadata?: Json
          platform: Database["public"]["Enums"]["external_publication_platform"]
          primary_query?: string | null
          quality_score?: number
          source_content_id?: string | null
          source_seo_opportunity_id?: string | null
          source_seo_plan_id?: string | null
          source_type: Database["public"]["Enums"]["external_publication_source_type"]
          status?: Database["public"]["Enums"]["external_publication_status"]
          target_slug?: string | null
          target_url: string
          template_id?: string | null
          title_options?: Json
          topic: string
          updated_at?: string
          usefulness_score?: number
          utm_campaign: string
          utm_content: string
          utm_medium?: string
          utm_source: string
          validation_result?: Json
          visual_plan?: Json
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by_profile_id?: string | null
          backlink_safety_score?: number
          body_markdown?: string | null
          body_plaintext?: string | null
          body_platform_specific?: string | null
          campaign_id?: string | null
          compliance_warnings?: Json
          copy_blocks?: Json
          created_at?: string
          evidence_pack?: Json
          exported_at?: string | null
          generated_by_profile_id?: string | null
          gsc_snapshot?: Json
          id?: string
          link_plan?: Json
          locale?: string
          manual_published_at?: string | null
          manual_published_url?: string | null
          metadata?: Json
          platform?: Database["public"]["Enums"]["external_publication_platform"]
          primary_query?: string | null
          quality_score?: number
          source_content_id?: string | null
          source_seo_opportunity_id?: string | null
          source_seo_plan_id?: string | null
          source_type?: Database["public"]["Enums"]["external_publication_source_type"]
          status?: Database["public"]["Enums"]["external_publication_status"]
          target_slug?: string | null
          target_url?: string
          template_id?: string | null
          title_options?: Json
          topic?: string
          updated_at?: string
          usefulness_score?: number
          utm_campaign?: string
          utm_content?: string
          utm_medium?: string
          utm_source?: string
          validation_result?: Json
          visual_plan?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_packages_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "external_publication_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_generated_by_profile_id_fkey"
            columns: ["generated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_source_seo_opportunity_id_fkey"
            columns: ["source_seo_opportunity_id"]
            isOneToOne: false
            referencedRelation: "seo_content_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_source_seo_plan_id_fkey"
            columns: ["source_seo_plan_id"]
            isOneToOne: false
            referencedRelation: "seo_content_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_packages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_assets: {
        Row: {
          alt_text: string | null
          asset_type: Database["public"]["Enums"]["external_publication_asset_type"]
          created_at: string
          description: string | null
          id: string
          markdown_embed: string | null
          metadata: Json
          package_id: string
          public_url: string | null
          storage_bucket: string | null
          storage_path: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          alt_text?: string | null
          asset_type: Database["public"]["Enums"]["external_publication_asset_type"]
          created_at?: string
          description?: string | null
          id?: string
          markdown_embed?: string | null
          metadata?: Json
          package_id: string
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          alt_text?: string | null
          asset_type?: Database["public"]["Enums"]["external_publication_asset_type"]
          created_at?: string
          description?: string | null
          id?: string
          markdown_embed?: string | null
          metadata?: Json
          package_id?: string
          public_url?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_assets_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "external_publication_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_events: {
        Row: {
          actor_profile_id: string | null
          event_type: Database["public"]["Enums"]["external_publication_event_type"]
          id: string
          occurred_at: string
          package_id: string
          payload: Json
          workspace_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          event_type: Database["public"]["Enums"]["external_publication_event_type"]
          id?: string
          occurred_at?: string
          package_id: string
          payload?: Json
          workspace_id: string
        }
        Update: {
          actor_profile_id?: string | null
          event_type?: Database["public"]["Enums"]["external_publication_event_type"]
          id?: string
          occurred_at?: string
          package_id?: string
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "external_publication_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_platform_profiles: {
        Row: {
          blocked_communities: string[]
          created_at: string
          default_disclosure: string | null
          metadata: Json
          platform: Database["public"]["Enums"]["external_publication_platform"]
          preferred_communities: Json
          tone_rules: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocked_communities?: string[]
          created_at?: string
          default_disclosure?: string | null
          metadata?: Json
          platform: Database["public"]["Enums"]["external_publication_platform"]
          preferred_communities?: Json
          tone_rules?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocked_communities?: string[]
          created_at?: string
          default_disclosure?: string | null
          metadata?: Json
          platform?: Database["public"]["Enums"]["external_publication_platform"]
          preferred_communities?: Json
          tone_rules?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_platform_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_research_jobs: {
        Row: {
          attempts: number
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          package_id: string | null
          priority: number
          provider: string
          result_summary: Json
          run_after: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          package_id?: string | null
          priority?: number
          provider: string
          result_summary?: Json
          run_after?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: Json
          job_type?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          package_id?: string | null
          priority?: number
          provider?: string
          result_summary?: Json
          run_after?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_research_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "external_publication_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_research_jobs_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "external_publication_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_research_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      external_publication_research_documents: {
        Row: {
          canonical_url: string
          content_hash: string
          created_at: string
          excerpt: string | null
          id: string
          markdown: string | null
          metadata: Json
          package_id: string | null
          provider: string
          research_job_id: string | null
          source_kind: string
          source_url: string
          title: string | null
          trust_tier: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          canonical_url: string
          content_hash: string
          created_at?: string
          excerpt?: string | null
          id?: string
          markdown?: string | null
          metadata?: Json
          package_id?: string | null
          provider: string
          research_job_id?: string | null
          source_kind: string
          source_url: string
          title?: string | null
          trust_tier?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          canonical_url?: string
          content_hash?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          markdown?: string | null
          metadata?: Json
          package_id?: string | null
          provider?: string
          research_job_id?: string | null
          source_kind?: string
          source_url?: string
          title?: string | null
          trust_tier?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_publication_research_documents_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "external_publication_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_research_documents_research_job_id_fkey"
            columns: ["research_job_id"]
            isOneToOne: false
            referencedRelation: "external_publication_research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_publication_research_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_balance_millicents: number
          ai_model_configs: Json
          compute_credits: number
          created_at: string
          default_locale: string
          id: string
          is_active: boolean
          is_system_generated: boolean
          legacy_template_id: string
          metadata: Json
          name: string
          owner_profile_id: string | null
          slug: string
          updated_at: string
          wallpaper_url: string | null
          workspace_tier: string
        }
        Insert: {
          ai_balance_millicents?: number
          ai_model_configs?: Json
          compute_credits?: number
          created_at?: string
          default_locale?: string
          id?: string
          is_active?: boolean
          is_system_generated?: boolean
          legacy_template_id: string
          metadata?: Json
          name: string
          owner_profile_id?: string | null
          slug: string
          updated_at?: string
          wallpaper_url?: string | null
          workspace_tier?: string
        }
        Update: {
          ai_balance_millicents?: number
          ai_model_configs?: Json
          compute_credits?: number
          created_at?: string
          default_locale?: string
          id?: string
          is_active?: boolean
          is_system_generated?: boolean
          legacy_template_id?: string
          metadata?: Json
          name?: string
          owner_profile_id?: string | null
          slug?: string
          updated_at?: string
          wallpaper_url?: string | null
          workspace_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _seed_elevenlabs_preset_voices: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      admin_create_workspace: {
        Args: { p_legacy_template_id?: string; p_name: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          name: string
          slug: string
        }[]
      }
      booking_build_public_reference: { Args: never; Returns: string }
      booking_expire_unpaid_reservations: {
        Args: { p_workspace_id?: string }
        Returns: number
      }
      can_access_booking_workspace: {
        Args: { p_capability_key?: string; p_workspace_id: string }
        Returns: boolean
      }
      can_access_workspace: {
        Args: { p_capability_key?: string; p_workspace_id: string }
        Returns: boolean
      }
      charge_ai_usage: {
        Args: {
          p_base_cost_millicents: number
          p_char_count: number
          p_image_count: number
          p_metadata: Json
          p_model: string
          p_platform_fee_millicents: number
          p_profile_id: string
          p_route: string
          p_status: string
          p_tokens_in: number
          p_tokens_out: number
          p_unit_type: string
          p_workspace_id: string
        }
        Returns: {
          base_cost_millicents: number
          char_count: number | null
          charged_millicents: number
          created_at: string
          id: string
          image_count: number | null
          metadata: Json
          model: string
          platform_fee_millicents: number
          profile_id: string | null
          route: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
          unit_type: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_usage_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_and_record_ai_request: {
        Args: {
          p_max_per_window: number
          p_route: string
          p_window_secs?: number
          p_workspace_id: string
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_secs: number
          used: number
        }[]
      }
      claim_next_content_translation_job: {
        Args: { p_lease_timeout?: string; p_worker_id: string }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          result_summary: Json
          run_after: string
          source_content_id: string
          source_locale: string
          source_version: string
          started_at: string | null
          status: string
          target_locales: string[]
          updated_at: string
          worker_id: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "content_translation_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_next_external_publication_research_job: {
        Args: { p_worker_id: string }
        Returns: {
          attempts: number
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input: Json
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          package_id: string | null
          priority: number
          provider: string
          result_summary: Json
          run_after: string
          status: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "external_publication_research_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_workspace_compute_credit_and_create_video_job: {
        Args: {
          p_content_id: string
          p_storage_path: string
          p_workspace_id: string
        }
        Returns: string
      }
      count_recent_ai_requests: {
        Args: {
          p_route: string
          p_window_secs?: number
          p_workspace_id: string
        }
        Returns: number
      }
      ensure_btw_quarter: {
        Args: { p_on?: string; p_workspace_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          ends_on: string
          id: string
          kind: Database["public"]["Enums"]["accounting_period_kind"]
          starts_on: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fill_locale_field_ar: { Args: { input: Json }; Returns: Json }
      get_effective_content_workspace_id: {
        Args: { p_template_id: string; p_workspace_id: string }
        Returns: string
      }
      get_my_role: { Args: never; Returns: string }
      grant_ai_credits: {
        Args:
          | {
              p_delta_millicents: number
              p_metadata: Json
              p_notes: string | null
              p_reason: string
              p_workspace_id: string
            }
          | {
              p_delta_millicents: number
              p_notes: string | null
              p_reason: string
              p_workspace_id: string
            }
        Returns: {
          actor_profile_id: string | null
          created_at: string
          delta_millicents: number
          id: string
          metadata: Json
          notes: string | null
          reason: string
          usage_event_id: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "ai_credit_ledger"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_workspace_capability: {
        Args: { p_capability_key: string; p_workspace_id: string }
        Returns: boolean
      }
      is_manager_assigned_workspace: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_admin_or_manager: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_booking_enabled: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: { Args: { p_workspace_id: string }; Returns: boolean }
      newsletter_unlock_consume: {
        Args: { p_per_tool_cap: number; p_token: string; p_tool: string }
        Returns: Database["public"]["CompositeTypes"]["newsletter_unlock_consume_result"]
        SetofOptions: {
          from: "*"
          to: "newsletter_unlock_consume_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      newsletter_unlock_remaining: {
        Args: { p_per_tool_cap: number; p_token: string; p_tool: string }
        Returns: number
      }
      record_ai_request: {
        Args: { p_route: string; p_workspace_id: string }
        Returns: undefined
      }
      resolve_workspace_id_from_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      storage_path_workspace_uuid: { Args: { p_name: string }; Returns: string }
      submit_contact_inquiry_with_email_jobs: {
        Args: {
          p_email_jobs: Json
          p_inquiry: Json
          p_submission_fingerprint: string
          p_submission_id: string
          p_workspace_id: string
        }
        Returns: {
          created: boolean
          inquiry_id: string
        }[]
      }
      tool_rate_limit_increment: {
        Args: { p_bucket: string; p_window_start: string }
        Returns: number
      }
      tool_scan_cache_evict_expired: { Args: never; Returns: number }
    }
    Enums: {
      accounting_entry_direction: "income" | "expense"
      accounting_period_kind: "btw_quarter" | "fiscal_year"
      accounting_report_format: "pdf" | "csv" | "ubl_xml"
      accounting_report_kind: "btw_prep" | "year_overview" | "ledger_export"
      booking_actor_type:
        | "system"
        | "user"
        | "workspace_manager"
        | "customer"
        | "anonymous"
      booking_availability_rule_type: "recurring" | "date_override" | "seasonal"
      booking_capacity_mode: "single" | "group" | "pooled" | "capacity"
      booking_entity_mode: "service" | "listing" | "experience" | "inquiry"
      booking_location_mode: "remote" | "onsite" | "hybrid"
      booking_location_type: "site" | "office" | "venue" | "property" | "remote"
      booking_notification_channel:
        | "email"
        | "internal_dashboard"
        | "sms"
        | "webhook"
      booking_notification_delivery_status:
        | "pending"
        | "sent"
        | "failed"
        | "skipped"
        | "delivered"
        | "delayed"
        | "bounced"
        | "complained"
      booking_notification_event_type:
        | "reservation_created"
        | "reservation_pending_review"
        | "reservation_confirmed"
        | "reservation_cancelled"
        | "reservation_completed"
        | "reservation_rescheduled"
        | "reservation_reschedule_requested"
        | "meeting_ready"
        | "reservation_no_show"
        | "payment_requested"
        | "payment_reminder"
        | "payment_expired"
        | "payment_failed"
        | "payment_refunded"
        | "appointment_reminder"
        | "post_session_followup"
      booking_payment_status:
        | "requested"
        | "verified"
        | "failed"
        | "expired"
        | "refunded"
      booking_profile_status: "draft" | "active" | "archived"
      booking_reservation_status:
        | "draft"
        | "pending_review"
        | "pending_confirmation"
        | "confirmed"
        | "completed"
        | "cancelled_by_customer"
        | "cancelled_by_workspace"
        | "no_show"
        | "expired"
      booking_resource_type:
        | "staff"
        | "agent"
        | "room"
        | "table_zone"
        | "property"
        | "generic_asset"
      booking_rule_scope_type: "workspace" | "service" | "resource" | "location"
      booking_service_visibility_status:
        | "draft"
        | "published"
        | "hidden"
        | "archived"
      booking_slot_strategy:
        | "fixed_slot"
        | "property_aware"
        | "capacity_seating"
        | "flexible_window"
      booking_template_key: "consultation" | "real_estate" | "horeca" | "custom"
      booking_trigger_source:
        | "system"
        | "operator"
        | "customer"
        | "public_flow"
        | "rule_engine"
      cleaning_schedule_frequency_kind:
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "quarterly"
        | "yearly"
        | "on_demand"
        | "custom"
      external_publication_asset_type:
        | "featured_image"
        | "inline_image"
        | "diagram_mermaid"
        | "diagram_png"
        | "link_card"
        | "download_bundle"
      external_publication_event_type:
        | "generated"
        | "validated"
        | "approved"
        | "exported"
        | "published_manual"
        | "rejected"
        | "stale"
        | "analytics_attributed"
      external_publication_platform:
        | "medium"
        | "reddit"
        | "linkedin"
        | "devto"
        | "indiehackers"
        | "quora"
        | "generic_forum"
        | "generic_article"
      external_publication_source_type:
        | "gsc_query"
        | "seo_plan"
        | "seo_opportunity"
        | "content_item"
        | "manual_brief"
        | "market_signal"
      external_publication_status:
        | "draft"
        | "generated"
        | "needs_review"
        | "approved"
        | "exported"
        | "published_manual"
        | "archived"
        | "rejected"
      legal_agreement_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed"
        | "void"
        | "expired"
      legal_document_kind:
        | "agreement"
        | "invoice"
        | "receipt"
        | "accounting_export"
        | "identity"
        | "correspondence"
        | "other"
      legal_signature_event_kind:
        | "sent"
        | "opened"
        | "viewed"
        | "signed"
        | "declined"
        | "expired"
        | "voided"
      legal_template_category:
        | "dvo"
        | "nda"
        | "dpa"
        | "invoice"
        | "quote"
        | "generic"
      seo_execution_status:
        | "previewed"
        | "applied"
        | "manual_review_required"
        | "failed"
        | "rolled_back"
      seo_funnel_stage: "top" | "middle" | "bottom"
      seo_opportunity_type:
        | "blue_ocean"
        | "cluster_gap"
        | "orphan_support"
        | "conversion_support"
        | "authority_expansion"
      seo_plan_status:
        | "draft"
        | "saved"
        | "approved"
        | "dismissed"
        | "in_progress"
        | "done"
      seo_recommendation_status:
        | "pending"
        | "approved"
        | "dismissed"
        | "implemented"
        | "superseded"
        | "ready_to_apply"
        | "applied"
        | "manual_review_required"
        | "failed"
        | "rolled_back"
        | "applying"
      seo_rollback_status:
        | "not_requested"
        | "rolled_back"
        | "conflict"
        | "failed"
      seo_run_status: "queued" | "running" | "completed" | "failed"
      seo_run_type:
        | "specialist_audit"
        | "strategist_analysis"
        | "content_graph_refresh"
      workspace_opportunity_category: "seo" | "content" | "conversion" | "market"
      workspace_opportunity_scan_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
      workspace_opportunity_severity: "low" | "medium" | "high"
      workspace_opportunity_status:
        | "pending"
        | "approved"
        | "dismissed"
        | "implemented"
        | "superseded"
    }
    CompositeTypes: {
      newsletter_unlock_consume_result: {
        allowed: boolean | null
        uses_remaining: number | null
        reason: string | null
      }
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
      accounting_entry_direction: ["income", "expense"],
      accounting_period_kind: ["btw_quarter", "fiscal_year"],
      accounting_report_format: ["pdf", "csv", "ubl_xml"],
      accounting_report_kind: ["btw_prep", "year_overview", "ledger_export"],
      booking_actor_type: [
        "system",
        "user",
        "workspace_manager",
        "customer",
        "anonymous",
      ],
      booking_availability_rule_type: [
        "recurring",
        "date_override",
        "seasonal",
      ],
      booking_capacity_mode: ["single", "group", "pooled", "capacity"],
      booking_entity_mode: ["service", "listing", "experience", "inquiry"],
      booking_location_mode: ["remote", "onsite", "hybrid"],
      booking_location_type: ["site", "office", "venue", "property", "remote"],
      booking_notification_channel: [
        "email",
        "internal_dashboard",
        "sms",
        "webhook",
      ],
      booking_notification_delivery_status: [
        "pending",
        "sent",
        "failed",
        "skipped",
        "delivered",
        "delayed",
        "bounced",
        "complained",
      ],
      booking_notification_event_type: [
        "reservation_created",
        "reservation_pending_review",
        "reservation_confirmed",
        "reservation_cancelled",
        "reservation_completed",
        "reservation_rescheduled",
        "reservation_reschedule_requested",
        "meeting_ready",
        "reservation_no_show",
        "payment_requested",
        "payment_reminder",
        "payment_expired",
        "payment_failed",
        "payment_refunded",
        "appointment_reminder",
        "post_session_followup",
      ],
      booking_payment_status: [
        "requested",
        "verified",
        "failed",
        "expired",
        "refunded",
      ],
      booking_profile_status: ["draft", "active", "archived"],
      booking_reservation_status: [
        "draft",
        "pending_review",
        "pending_confirmation",
        "confirmed",
        "completed",
        "cancelled_by_customer",
        "cancelled_by_workspace",
        "no_show",
        "expired",
      ],
      booking_resource_type: [
        "staff",
        "agent",
        "room",
        "table_zone",
        "property",
        "generic_asset",
      ],
      booking_rule_scope_type: ["workspace", "service", "resource", "location"],
      booking_service_visibility_status: [
        "draft",
        "published",
        "hidden",
        "archived",
      ],
      booking_slot_strategy: [
        "fixed_slot",
        "property_aware",
        "capacity_seating",
        "flexible_window",
      ],
      booking_template_key: ["consultation", "real_estate", "horeca", "custom"],
      booking_trigger_source: [
        "system",
        "operator",
        "customer",
        "public_flow",
        "rule_engine",
      ],
      cleaning_schedule_frequency_kind: [
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "yearly",
        "on_demand",
        "custom",
      ],
      external_publication_asset_type: [
        "featured_image",
        "inline_image",
        "diagram_mermaid",
        "diagram_png",
        "link_card",
        "download_bundle",
      ],
      external_publication_event_type: [
        "generated",
        "validated",
        "approved",
        "exported",
        "published_manual",
        "rejected",
        "stale",
        "analytics_attributed",
      ],
      external_publication_platform: [
        "medium",
        "reddit",
        "linkedin",
        "devto",
        "indiehackers",
        "quora",
        "generic_forum",
        "generic_article",
      ],
      external_publication_source_type: [
        "gsc_query",
        "seo_plan",
        "seo_opportunity",
        "content_item",
        "manual_brief",
        "market_signal",
      ],
      external_publication_status: [
        "draft",
        "generated",
        "needs_review",
        "approved",
        "exported",
        "published_manual",
        "archived",
        "rejected",
      ],
      legal_agreement_status: [
        "draft",
        "sent",
        "viewed",
        "signed",
        "void",
        "expired",
      ],
      legal_document_kind: [
        "agreement",
        "invoice",
        "receipt",
        "accounting_export",
        "identity",
        "correspondence",
        "other",
      ],
      legal_signature_event_kind: [
        "sent",
        "opened",
        "viewed",
        "signed",
        "declined",
        "expired",
        "voided",
      ],
      legal_template_category: [
        "dvo",
        "nda",
        "dpa",
        "invoice",
        "quote",
        "generic",
      ],
      seo_execution_status: [
        "previewed",
        "applied",
        "manual_review_required",
        "failed",
        "rolled_back",
      ],
      seo_funnel_stage: ["top", "middle", "bottom"],
      seo_opportunity_type: [
        "blue_ocean",
        "cluster_gap",
        "orphan_support",
        "conversion_support",
        "authority_expansion",
      ],
      seo_plan_status: [
        "draft",
        "saved",
        "approved",
        "dismissed",
        "in_progress",
        "done",
      ],
      seo_recommendation_status: [
        "pending",
        "approved",
        "dismissed",
        "implemented",
        "superseded",
        "ready_to_apply",
        "applied",
        "manual_review_required",
        "failed",
        "rolled_back",
        "applying",
      ],
      seo_rollback_status: [
        "not_requested",
        "rolled_back",
        "conflict",
        "failed",
      ],
      seo_run_status: ["queued", "running", "completed", "failed"],
      seo_run_type: [
        "specialist_audit",
        "strategist_analysis",
        "content_graph_refresh",
      ],
      workspace_opportunity_category: ["seo", "content", "conversion", "market"],
      workspace_opportunity_scan_status: [
        "queued",
        "running",
        "completed",
        "failed",
      ],
      workspace_opportunity_severity: ["low", "medium", "high"],
      workspace_opportunity_status: [
        "pending",
        "approved",
        "dismissed",
        "implemented",
        "superseded",
      ],
    },
  },
} as const
