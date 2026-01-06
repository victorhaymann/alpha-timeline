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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachment_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          task_id: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          task_id: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          task_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_steps: {
        Row: {
          category_group: string | null
          created_at: string
          default_review_rounds: number | null
          default_weight_percent: number | null
          description: string | null
          id: string
          is_optional: boolean | null
          name: string
          phase_category: string
          sort_order: number
          task_type: Database["public"]["Enums"]["task_type"]
        }
        Insert: {
          category_group?: string | null
          created_at?: string
          default_review_rounds?: number | null
          default_weight_percent?: number | null
          description?: string | null
          id?: string
          is_optional?: boolean | null
          name: string
          phase_category: string
          sort_order?: number
          task_type?: Database["public"]["Enums"]["task_type"]
        }
        Update: {
          category_group?: string | null
          created_at?: string
          default_review_rounds?: number | null
          default_weight_percent?: number | null
          description?: string | null
          id?: string
          is_optional?: boolean | null
          name?: string
          phase_category?: string
          sort_order?: number
          task_type?: Database["public"]["Enums"]["task_type"]
        }
        Relationships: []
      }
      change_requests: {
        Row: {
          author_role: string | null
          created_at: string
          description: string
          id: string
          project_id: string
          responded_at: string | null
          response: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          author_role?: string | null
          created_at?: string
          description: string
          id?: string
          project_id: string
          responded_at?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          author_role?: string | null
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          responded_at?: string | null
          response?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_role: string | null
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_role?: string | null
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_role?: string | null
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          created_at: string
          id: string
          lag_days: number | null
          predecessor_task_id: string
          successor_task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lag_days?: number | null
          predecessor_task_id: string
          successor_task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lag_days?: number | null
          predecessor_task_id?: string
          successor_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_predecessor_task_id_fkey"
            columns: ["predecessor_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_successor_task_id_fkey"
            columns: ["successor_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          name: string
          project_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          project_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          created_at: string
          created_by: string
          general_notes: string | null
          id: string
          meeting_date: string
          project_id: string
          task_notes: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          general_notes?: string | null
          id?: string
          meeting_date: string
          project_id: string
          task_notes?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          general_notes?: string | null
          id?: string
          meeting_date?: string
          project_id?: string
          task_notes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          collapsed_by_default: boolean | null
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          percentage_allocation: number
          project_id: string
          updated_at: string
        }
        Insert: {
          collapsed_by_default?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          percentage_allocation?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          collapsed_by_default?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          percentage_allocation?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_shares: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          project_id: string
          share_type: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          project_id: string
          share_type: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          project_id?: string
          share_type?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_shares_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_steps: {
        Row: {
          canonical_step_id: string
          created_at: string
          custom_review_rounds: number | null
          custom_weight_percent: number | null
          id: string
          is_included: boolean | null
          project_id: string
        }
        Insert: {
          canonical_step_id: string
          created_at?: string
          custom_review_rounds?: number | null
          custom_weight_percent?: number | null
          id?: string
          is_included?: boolean | null
          project_id: string
        }
        Update: {
          canonical_step_id?: string
          created_at?: string
          custom_review_rounds?: number | null
          custom_weight_percent?: number | null
          id?: string
          is_included?: boolean | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_steps_canonical_step_id_fkey"
            columns: ["canonical_step_id"]
            isOneToOne: false
            referencedRelation: "canonical_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          buffer_percentage: number | null
          checkin_duration: number | null
          checkin_frequency: string | null
          checkin_time: string | null
          checkin_timezone: string | null
          checkin_weekday: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          default_review_rounds: number | null
          description: string | null
          end_date: string
          id: string
          name: string
          owner_id: string
          pm_email: string | null
          pm_name: string | null
          pm_whatsapp: string | null
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          timezone_client: string | null
          timezone_pm: string | null
          updated_at: string
          working_days_mask: number | null
          zoom_link_default: string | null
        }
        Insert: {
          buffer_percentage?: number | null
          checkin_duration?: number | null
          checkin_frequency?: string | null
          checkin_time?: string | null
          checkin_timezone?: string | null
          checkin_weekday?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          default_review_rounds?: number | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          owner_id: string
          pm_email?: string | null
          pm_name?: string | null
          pm_whatsapp?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["project_status"]
          timezone_client?: string | null
          timezone_pm?: string | null
          updated_at?: string
          working_days_mask?: number | null
          zoom_link_default?: string | null
        }
        Update: {
          buffer_percentage?: number | null
          checkin_duration?: number | null
          checkin_frequency?: string | null
          checkin_time?: string | null
          checkin_timezone?: string | null
          checkin_weekday?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          default_review_rounds?: number | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          owner_id?: string
          pm_email?: string | null
          pm_name?: string | null
          pm_whatsapp?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          timezone_client?: string | null
          timezone_pm?: string | null
          updated_at?: string
          working_days_mask?: number | null
          zoom_link_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          name: string
          project_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          project_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          project_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      share_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          share_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          share_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          share_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_invites_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "project_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      step_templates: {
        Row: {
          category: string | null
          created_at: string
          default_percentage: number | null
          default_review_rounds: number | null
          description: string | null
          id: string
          is_feedback_meeting: boolean | null
          is_milestone: boolean | null
          name: string
          owner_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_percentage?: number | null
          default_review_rounds?: number | null
          description?: string | null
          id?: string
          is_feedback_meeting?: boolean | null
          is_milestone?: boolean | null
          name: string
          owner_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_percentage?: number | null
          default_review_rounds?: number | null
          description?: string | null
          id?: string
          is_feedback_meeting?: boolean | null
          is_milestone?: boolean | null
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          client_visible: boolean | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_feedback_meeting: boolean | null
          is_milestone: boolean | null
          name: string
          narrative_text: string | null
          order_index: number
          percentage_allocation: number
          phase_id: string
          project_id: string | null
          review_rounds: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          weight_percent: number | null
        }
        Insert: {
          client_visible?: boolean | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_feedback_meeting?: boolean | null
          is_milestone?: boolean | null
          name: string
          narrative_text?: string | null
          order_index?: number
          percentage_allocation?: number
          phase_id: string
          project_id?: string | null
          review_rounds?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          weight_percent?: number | null
        }
        Update: {
          client_visible?: boolean | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_feedback_meeting?: boolean | null
          is_milestone?: boolean | null
          name?: string
          narrative_text?: string | null
          order_index?: number
          percentage_allocation?: number
          phase_id?: string
          project_id?: string | null
          review_rounds?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          weight_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_client_access: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      change_request_status: "pending" | "approved" | "rejected"
      project_status: "draft" | "active" | "completed" | "archived"
      task_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "blocked"
      task_type: "task" | "milestone" | "meeting"
      user_role: "pm" | "client"
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
      change_request_status: ["pending", "approved", "rejected"],
      project_status: ["draft", "active", "completed", "archived"],
      task_status: ["pending", "in_progress", "review", "completed", "blocked"],
      task_type: ["task", "milestone", "meeting"],
      user_role: ["pm", "client"],
    },
  },
} as const
