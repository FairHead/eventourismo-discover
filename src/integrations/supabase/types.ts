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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      artist_profiles: {
        Row: {
          available_for_bookings: boolean | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          experience_years: number | null
          genres: string[] | null
          id: string
          instruments: string[] | null
          links: Json | null
          performance_radius_km: number | null
          phone_number: string | null
          price_range: string | null
          social_links: Json | null
          stage_name: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          available_for_bookings?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          experience_years?: number | null
          genres?: string[] | null
          id?: string
          instruments?: string[] | null
          links?: Json | null
          performance_radius_km?: number | null
          phone_number?: string | null
          price_range?: string | null
          social_links?: Json | null
          stage_name?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          available_for_bookings?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          experience_years?: number | null
          genres?: string[] | null
          id?: string
          instruments?: string[] | null
          links?: Json | null
          performance_radius_km?: number | null
          phone_number?: string | null
          price_range?: string | null
          social_links?: Json | null
          stage_name?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      band_invitations: {
        Row: {
          band_id: string
          created_at: string
          expires_at: string | null
          id: string
          invited_instruments: string[] | null
          invited_role: string | null
          invitee_id: string
          inviter_id: string
          message: string | null
          status: string
          updated_at: string
        }
        Insert: {
          band_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_instruments?: string[] | null
          invited_role?: string | null
          invitee_id: string
          inviter_id: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          band_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_instruments?: string[] | null
          invited_role?: string | null
          invitee_id?: string
          inviter_id?: string
          message?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_invitations_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      band_members: {
        Row: {
          artist_id: string
          band_id: string
          created_at: string
          id: string
          instruments: string[] | null
          is_active: boolean | null
          joined_at: string
          role: string | null
        }
        Insert: {
          artist_id: string
          band_id: string
          created_at?: string
          id?: string
          instruments?: string[] | null
          is_active?: boolean | null
          joined_at?: string
          role?: string | null
        }
        Update: {
          artist_id?: string
          band_id?: string
          created_at?: string
          id?: string
          instruments?: string[] | null
          is_active?: boolean | null
          joined_at?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_members_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artist_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "band_members_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          description: string | null
          formation_year: number | null
          genres: string[] | null
          id: string
          name: string
          slug: string | null
          social_links: Json | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          formation_year?: number | null
          genres?: string[] | null
          id?: string
          name: string
          slug?: string | null
          social_links?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          formation_year?: number | null
          genres?: string[] | null
          id?: string
          name?: string
          slug?: string | null
          social_links?: Json | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          band_id: string | null
          created_at: string
          description: string | null
          end_utc: string
          event_type: Database["public"]["Enums"]["event_type"]
          genres: string[] | null
          id: string
          images: string[] | null
          lat: number
          lng: number
          organizer_id: string
          recurrence_rule: string | null
          sources: Json | null
          start_utc: string
          status: Database["public"]["Enums"]["event_status"]
          ticket_url: string | null
          title: string
          updated_at: string
          venue_id: string | null
          website_url: string | null
        }
        Insert: {
          band_id?: string | null
          created_at?: string
          description?: string | null
          end_utc: string
          event_type?: Database["public"]["Enums"]["event_type"]
          genres?: string[] | null
          id?: string
          images?: string[] | null
          lat: number
          lng: number
          organizer_id: string
          recurrence_rule?: string | null
          sources?: Json | null
          start_utc: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_url?: string | null
          title: string
          updated_at?: string
          venue_id?: string | null
          website_url?: string | null
        }
        Update: {
          band_id?: string | null
          created_at?: string
          description?: string | null
          end_utc?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          genres?: string[] | null
          id?: string
          images?: string[] | null
          lat?: number
          lng?: number
          organizer_id?: string
          recurrence_rule?: string | null
          sources?: Json | null
          start_utc?: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_url?: string | null
          title?: string
          updated_at?: string
          venue_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_subscriptions: {
        Row: {
          city: string | null
          created_at: string
          event_types: string[] | null
          genres: string[] | null
          id: string
          push_enabled: boolean | null
          radius_km: number | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          event_types?: string[] | null
          genres?: string[] | null
          id?: string
          push_enabled?: boolean | null
          radius_km?: number | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          event_types?: string[] | null
          genres?: string[] | null
          id?: string
          push_enabled?: boolean | null
          radius_km?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          stars: number
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          stars: number
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          stars?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          message: string | null
          reminder_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          message?: string | null
          reminder_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          message?: string | null
          reminder_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reminders_event"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved: boolean | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved?: boolean | null
          target_id: string
          target_type: Database["public"]["Enums"]["target_type"]
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved?: boolean | null
          target_id?: string
          target_type?: Database["public"]["Enums"]["target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          postal_code: string | null
          preferred_genres: string[] | null
          role: Database["public"]["Enums"]["user_role"]
          street_address: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_genres?: string[] | null
          role?: Database["public"]["Enums"]["user_role"]
          street_address?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          postal_code?: string | null
          preferred_genres?: string[] | null
          role?: Database["public"]["Enums"]["user_role"]
          street_address?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string
          categories: string[] | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string
          description: string | null
          hero_image_url: string | null
          id: string
          lat: number
          lng: number
          name: string
          opening_hours: Json | null
          phone: string | null
          socials: Json | null
          sources: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address: string
          categories?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          opening_hours?: Json | null
          phone?: string | null
          socials?: Json | null
          sources?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string
          categories?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          socials?: Json | null
          sources?: Json | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_band_slug: {
        Args: { band_name: string }
        Returns: string
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_public_user_info: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_user_public_profile: {
        Args: { user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          city: string
          country: string
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      user_can_manage_band: {
        Args: { _band_id: string; _uid: string }
        Returns: boolean
      }
      venues_find_candidates: {
        Args: {
          v_lat: number
          v_lon: number
          v_name: string
          v_radius_m?: number
        }
        Returns: {
          address: string
          categories: string[] | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string
          description: string | null
          hero_image_url: string | null
          id: string
          lat: number
          lng: number
          name: string
          opening_hours: Json | null
          phone: string | null
          socials: Json | null
          sources: Json | null
          updated_at: string
          website: string | null
        }[]
      }
    }
    Enums: {
      event_status: "draft" | "published" | "cancelled"
      event_type: "street" | "concert" | "theater" | "club" | "other"
      favorite_target_type: "event" | "venue" | "artist"
      rating_target_type: "event" | "venue" | "artist"
      report_target_type: "event" | "venue" | "artist" | "user"
      target_type: "event" | "venue" | "comment" | "external_event"
      user_role: "user" | "artist" | "organizer" | "venue_admin" | "admin"
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
      event_status: ["draft", "published", "cancelled"],
      event_type: ["street", "concert", "theater", "club", "other"],
      favorite_target_type: ["event", "venue", "artist"],
      rating_target_type: ["event", "venue", "artist"],
      report_target_type: ["event", "venue", "artist", "user"],
      target_type: ["event", "venue", "comment", "external_event"],
      user_role: ["user", "artist", "organizer", "venue_admin", "admin"],
    },
  },
} as const
