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
      candidates: {
        Row: {
          bio: string
          created_at: string
          id: string
          name: string
          photo_url: string
          position_id: string
          updated_at: string
        }
        Insert: {
          bio?: string
          created_at?: string
          id?: string
          name: string
          photo_url?: string
          position_id: string
          updated_at?: string
        }
        Update: {
          bio?: string
          created_at?: string
          id?: string
          name?: string
          photo_url?: string
          position_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          activated_at: string | null
          created_at: string
          description: string
          election_type: string
          ended_at: string | null
          ends_at: string | null
          id: string
          location: string
          region: string
          starts_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          description?: string
          election_type?: string
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          location?: string
          region?: string
          starts_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          description?: string
          election_type?: string
          ended_at?: string | null
          ends_at?: string | null
          id?: string
          location?: string
          region?: string
          starts_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      eligible_voters: {
        Row: {
          id: string
          election_id: string
          full_name: string
          phone_number: string
          has_voted: boolean
          voted_at: string | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          election_id: string
          full_name: string
          phone_number: string
          has_voted?: boolean
          voted_at?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          full_name?: string
          phone_number?: string
          has_voted?: boolean
          voted_at?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligible_voters_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_requests: {
        Row: {
          id: string
          eligible_voter_id: string
          election_id: string
          code_hash: string
          expires_at: string
          is_used: boolean
          attempts: number
          created_at: string
        }
        Insert: {
          id?: string
          eligible_voter_id: string
          election_id: string
          code_hash: string
          expires_at: string
          is_used?: boolean
          attempts?: number
          created_at?: string
        }
        Update: {
          id?: string
          eligible_voter_id?: string
          election_id?: string
          code_hash?: string
          expires_at?: string
          is_used?: boolean
          attempts?: number
          created_at?: string
        }
        Relationships: []
      }
      voter_sessions: {
        Row: {
          id: string
          eligible_voter_id: string
          election_id: string
          token_hash: string
          expires_at: string
          is_used: boolean
          created_at: string
        }
        Insert: {
          id?: string
          eligible_voter_id: string
          election_id: string
          token_hash: string
          expires_at: string
          is_used?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          eligible_voter_id?: string
          election_id?: string
          token_hash?: string
          expires_at?: string
          is_used?: boolean
          created_at?: string
        }
        Relationships: []
      }
      vote_receipts: {
        Row: {
          id: string
          election_id: string
          receipt_code: string
          vote_uuid: string
          cast_at: string
        }
        Insert: {
          id?: string
          election_id: string
          receipt_code: string
          vote_uuid: string
          cast_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          receipt_code?: string
          vote_uuid?: string
          cast_at?: string
        }
        Relationships: []
      }
      voter_upload_audit: {
        Row: {
          id: string
          election_id: string
          uploaded_by: string
          total_rows: number
          accepted: number
          rejected: number
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          uploaded_by: string
          total_rows?: number
          accepted?: number
          rejected?: number
          created_at?: string
        }
        Update: {
          id?: string
          election_id?: string
          uploaded_by?: string
          total_rows?: number
          accepted?: number
          rejected?: number
          created_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          description: string
          display_order: number
          election_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          election_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          election_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ticket_audit_log: {
        Row: {
          id: string
          ticket_id: string
          election_id: string
          user_id: string
          action: string
          actor_id: string | null
          detail: Json
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          election_id: string
          user_id: string
          action: string
          actor_id?: string | null
          detail?: Json
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          election_id?: string
          user_id?: string
          action?: string
          actor_id?: string | null
          detail?: Json
          created_at?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          position_id: string
          ticket_id: string | null
          vote_uuid: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          position_id: string
          ticket_id?: string | null
          vote_uuid?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          position_id?: string
          ticket_id?: string | null
          vote_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      voting_tickets: {
        Row: {
          code: string
          election_id: string
          expires_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          status: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          election_id: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          status?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          election_id?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          status?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voting_tickets_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      election_history: {
        Row: {
          id: string
          title: string
          description: string
          status: string
          location: string
          region: string
          created_at: string
          activated_at: string | null
          ended_at: string | null
          starts_at: string | null
          ends_at: string | null
          tickets_issued: number
          tickets_active: number
          tickets_used: number
          tickets_terminated: number
          total_votes: number
          turnout_pct: number
        }
        Relationships: []
      }
      vote_tallies: {
        Row: {
          candidate_id: string
          position_id: string
          election_id: string
          vote_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      cast_voter_ballot: {
        Args: {
          _session_token: string
          _selections: Json
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      terminate_election_tickets: {
        Args: { _election_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "voter"
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
      app_role: ["admin", "voter"],
    },
  },
} as const
