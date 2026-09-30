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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      call_signals: {
        Row: {
          created_at: string
          id: string
          payload: Json
          recipient_id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          recipient_id: string
          sender_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          connected_at: string | null
          created_at: string
          end_reason: string | null
          ended_at: string | null
          ended_by: string | null
          id: string
          initiator_id: string
          mode: string
          started_at: string
          status: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          initiator_id: string
          mode: string
          started_at?: string
          status?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          initiator_id?: string
          mode?: string
          started_at?: string
          status?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_sessions_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body: string
          connection_id: string
          created_at: string
          deleted_by_recipient_at: string | null
          deleted_by_sender_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          connection_id: string
          created_at?: string
          deleted_by_recipient_at?: string | null
          deleted_by_sender_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          connection_id?: string
          created_at?: string
          deleted_by_recipient_at?: string | null
          deleted_by_sender_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "mutual_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      login_visits: {
        Row: {
          city: string | null
          country_code: string | null
          device_name: string | null
          district: string | null
          ended_at: string | null
          id: string
          ip_address: unknown
          last_seen_at: string
          region: string | null
          started_at: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          device_name?: string | null
          district?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          region?: string | null
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          device_name?: string | null
          district?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          region?: string | null
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_queue: {
        Row: {
          desired_mode: string
          expires_at: string
          generation: string
          heartbeat_at: string
          preference_snapshot: Json
          queued_at: string
          reserved_session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          desired_mode: string
          expires_at?: string
          generation?: string
          heartbeat_at?: string
          preference_snapshot?: Json
          queued_at?: string
          reserved_session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          desired_mode?: string
          expires_at?: string
          generation?: string
          heartbeat_at?: string
          preference_snapshot?: Json
          queued_at?: string
          reserved_session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          actor_id: string
          created_at: string
          id: string
          reason: string
          report_id: string | null
          target_user_id: string
        }
        Insert: {
          action_type: string
          actor_id: string
          created_at?: string
          id?: string
          reason: string
          report_id?: string | null
          target_user_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string
          created_at?: string
          id?: string
          reason?: string
          report_id?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mutual_connections: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          session_id: string | null
          status: string
          user_a_accepted_at: string | null
          user_a_id: string
          user_b_accepted_at: string | null
          user_b_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          status?: string
          user_a_accepted_at?: string | null
          user_a_id: string
          user_b_accepted_at?: string | null
          user_b_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          session_id?: string | null
          status?: string
          user_a_accepted_at?: string | null
          user_a_id?: string
          user_b_accepted_at?: string | null
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutual_connections_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutual_connections_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutual_connections_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acceptances: {
        Row: {
          accepted_at: string
          id: string
          policy_type: string
          policy_version: string
          source: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          policy_type: string
          policy_version: string
          source?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          policy_type?: string
          policy_version?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          auth_provider: string | null
          avatar_url: string | null
          banned_until: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          detected_city: string | null
          detected_country: string | null
          detected_district: string | null
          detected_region: string | null
          device_name: string | null
          display_name: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          is_banned: boolean
          last_ip: unknown
          last_login_at: string | null
          last_name: string | null
          last_seen_at: string | null
          onboarding_completed: boolean
          onboarding_seen_at: string | null
          pronouns: string | null
          tags: string[]
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          age?: number | null
          auth_provider?: string | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          detected_city?: string | null
          detected_country?: string | null
          detected_district?: string | null
          detected_region?: string | null
          device_name?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id: string
          is_banned?: boolean
          last_ip?: unknown
          last_login_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          onboarding_completed?: boolean
          onboarding_seen_at?: string | null
          pronouns?: string | null
          tags?: string[]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          age?: number | null
          auth_provider?: string | null
          avatar_url?: string | null
          banned_until?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          detected_city?: string | null
          detected_country?: string | null
          detected_district?: string | null
          detected_region?: string | null
          device_name?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          is_banned?: boolean
          last_ip?: unknown
          last_login_at?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          onboarding_completed?: boolean
          onboarding_seen_at?: string | null
          pronouns?: string | null
          tags?: string[]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          category: string
          created_at: string
          id: string
          note: string | null
          reported_user_id: string
          reporter_id: string
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_path: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          note?: string | null
          reported_user_id: string
          reporter_id: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string | null
          session_id?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          note?: string | null
          reported_user_id?: string
          reporter_id?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          id: string
          rating: number | null
          reason: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating?: number | null
          reason?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number | null
          reason?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          approximate_country: string | null
          approximate_region: string | null
          auto_next: boolean
          broaden_after_wait: boolean
          default_mode: string
          discoverable: boolean
          effects_enabled: boolean
          interests: string[]
          languages: string[]
          location_enabled: boolean
          mirror_preview: boolean
          preferred_countries: string[]
          similar_interests: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approximate_country?: string | null
          approximate_region?: string | null
          auto_next?: boolean
          broaden_after_wait?: boolean
          default_mode?: string
          discoverable?: boolean
          effects_enabled?: boolean
          interests?: string[]
          languages?: string[]
          location_enabled?: boolean
          mirror_preview?: boolean
          preferred_countries?: string[]
          similar_interests?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approximate_country?: string | null
          approximate_region?: string | null
          auto_next?: boolean
          broaden_after_wait?: boolean
          default_mode?: string
          discoverable?: boolean
          effects_enabled?: boolean
          interests?: string[]
          languages?: string[]
          location_enabled?: boolean
          mirror_preview?: boolean
          preferred_countries?: string[]
          similar_interests?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      accept_terms: { Args: never; Returns: undefined }
      admin_list_users: {
        Args: { _q: string }
        Returns: {
          banned_until: string
          block_count: number
          country_code: string
          created_at: string
          display_name: string
          id: string
          is_banned: boolean
          report_count: number
        }[]
      }
      admin_list_users_v2: {
        Args: { _q: string }
        Returns: {
          age: number
          avatar_url: string
          banned_until: string
          country_code: string
          created_at: string
          detected_city: string
          device_name: string
          display_name: string
          email: string
          first_name: string
          gender: string
          id: string
          is_banned: boolean
          last_ip: string
          last_login_at: string
          last_name: string
          last_seen_at: string
          report_count: number
          session_count: number
        }[]
      }
      admin_metrics: { Args: never; Returns: Json }
      admin_session_messages: {
        Args: { _session: string }
        Returns: {
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
        }[]
      }
      admin_user_consents: {
        Args: { _user: string }
        Returns: {
          accepted_at: string
          policy_type: string
          policy_version: string
          source: string
        }[]
      }
      admin_user_sessions: {
        Args: { _user: string }
        Returns: {
          created_at: string
          end_reason: string
          ended_at: string
          id: string
          message_count: number
          mode: string
          partner_id: string
          partner_name: string
          status: string
        }[]
      }
      admin_user_visits: {
        Args: { _user: string }
        Returns: {
          city: string
          country_code: string
          device_name: string
          ended_at: string
          id: string
          ip: string
          last_seen_at: string
          region: string
          started_at: string
        }[]
      }
      block_user: { Args: { _target: string }; Returns: undefined }
      complete_onboarding: {
        Args: {
          _age: number
          _country: string
          _first: string
          _gender: string
          _language: string
          _last: string
          _tags: string[]
        }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      ensure_my_profile: { Args: never; Returns: undefined }
      find_or_create_match: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_connection_member: {
        Args: { _conn: string; _uid: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      join_match_queue: {
        Args: { _mode: string; _snapshot?: Json }
        Returns: undefined
      }
      leave_match_queue: { Args: never; Returns: undefined }
      mark_onboarding_seen: { Args: never; Returns: undefined }
      moderate_user: {
        Args: {
          _action: string
          _reason: string
          _report?: string
          _target: string
        }
        Returns: undefined
      }
      record_policy_acceptance: {
        Args: { _source: string; _uid: string }
        Returns: undefined
      }
      remove_connection: { Args: { _conn: string }; Returns: undefined }
      session_transition: {
        Args: { _reason?: string; _session: string; _to: string }
        Returns: undefined
      }
      set_mutual_connection_decision: {
        Args: { _accept: boolean; _session: string }
        Returns: string
      }
      submit_report: {
        Args: {
          _block: boolean
          _category: string
          _note: string
          _reported: string
          _session: string
        }
        Returns: undefined
      }
      submit_report_v2: {
        Args: {
          _category: string
          _note: string
          _reported: string
          _screenshot: string
          _session: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
