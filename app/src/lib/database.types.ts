// Generated from the live schema. Do not edit by hand — after a migration
// lands, regenerate with `npm run types:db` (needs `supabase login` once);
// the header above `export type Json` is the only hand-written part.
//
// What this buys: `supabase` is created as `createClient<Database>`, so a
// query that names a column the table does not have, or writes a value of
// the wrong type, fails the typecheck instead of failing on a phone.

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
      _metadata_backup: {
        Row: {
          id: string | null
          raw_user_meta_data: Json | null
          saved_at: string | null
        }
        Insert: {
          id?: string | null
          raw_user_meta_data?: Json | null
          saved_at?: string | null
        }
        Update: {
          id?: string | null
          raw_user_meta_data?: Json | null
          saved_at?: string | null
        }
        Relationships: []
      }
      app_flags: {
        Row: {
          enabled: boolean
          key: string
          note: string | null
          updated_at: string
        }
        Insert: {
          enabled: boolean
          key: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked: string
          blocker: string
          created_at: string
        }
        Insert: {
          blocked: string
          blocker: string
          created_at?: string
        }
        Update: {
          blocked?: string
          blocker?: string
          created_at?: string
        }
        Relationships: []
      }
      category_terms: {
        Row: {
          category: string
          terms: string[]
          updated_at: string
        }
        Insert: {
          category: string
          terms?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          terms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          center_lat: number
          center_lng: number
          hero_cta_en: string | null
          hero_cta_ja: string | null
          hero_cta_vi: string | null
          hero_place_slug: string | null
          hero_sub_en: string | null
          hero_sub_ja: string | null
          hero_sub_vi: string | null
          hero_title_en: string | null
          hero_title_ja: string | null
          hero_title_vi: string | null
          id: string
          is_active: boolean
          name_en: string
          name_ja: string | null
          name_vi: string
          radius_km: number
          short_en: string
          short_ja: string | null
          short_vi: string
          sort_order: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          hero_cta_en?: string | null
          hero_cta_ja?: string | null
          hero_cta_vi?: string | null
          hero_place_slug?: string | null
          hero_sub_en?: string | null
          hero_sub_ja?: string | null
          hero_sub_vi?: string | null
          hero_title_en?: string | null
          hero_title_ja?: string | null
          hero_title_vi?: string | null
          id: string
          is_active?: boolean
          name_en: string
          name_ja?: string | null
          name_vi: string
          radius_km?: number
          short_en: string
          short_ja?: string | null
          short_vi: string
          sort_order?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          hero_cta_en?: string | null
          hero_cta_ja?: string | null
          hero_cta_vi?: string | null
          hero_place_slug?: string | null
          hero_sub_en?: string | null
          hero_sub_ja?: string | null
          hero_sub_vi?: string | null
          hero_title_en?: string | null
          hero_title_ja?: string | null
          hero_title_vi?: string | null
          id?: string
          is_active?: boolean
          name_en?: string
          name_ja?: string | null
          name_vi?: string
          radius_km?: number
          short_en?: string
          short_ja?: string | null
          short_vi?: string
          sort_order?: number
        }
        Relationships: []
      }
      collection_likes: {
        Row: {
          collection_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_likes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_places: {
        Row: {
          collection_id: string
          created_at: string
          place_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          created_at?: string
          place_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          created_at?: string
          place_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_places_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          city_id: string
          cover_photo_id: string | null
          created_at: string
          curator_handle: string | null
          desc_en: string | null
          desc_ja: string | null
          desc_vi: string | null
          id: string
          is_public: boolean
          owner_id: string | null
          slug: string
          sort_order: number | null
          title_en: string
          title_ja: string | null
          title_vi: string
        }
        Insert: {
          city_id?: string
          cover_photo_id?: string | null
          created_at?: string
          curator_handle?: string | null
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string | null
          slug: string
          sort_order?: number | null
          title_en: string
          title_ja?: string | null
          title_vi: string
        }
        Update: {
          city_id?: string
          cover_photo_id?: string | null
          created_at?: string
          curator_handle?: string | null
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string | null
          slug?: string
          sort_order?: number | null
          title_en?: string
          title_ja?: string | null
          title_vi?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "place_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      editors: {
        Row: {
          added_at: string
          email: string
        }
        Insert: {
          added_at?: string
          email: string
        }
        Update: {
          added_at?: string
          email?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee: string
          created_at: string
          requester: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee: string
          created_at?: string
          requester: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee?: string
          created_at?: string
          requester?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      moderation_log: {
        Row: {
          action: string
          actor: string
          actor_email: string
          created_at: string
          detail: Json
          id: number
          target_id: string
        }
        Insert: {
          action: string
          actor: string
          actor_email: string
          created_at?: string
          detail?: Json
          id?: never
          target_id: string
        }
        Update: {
          action?: string
          actor?: string
          actor_email?: string
          created_at?: string
          detail?: Json
          id?: never
          target_id?: string
        }
        Relationships: []
      }
      ops_tokens: {
        Row: {
          created_at: string
          expires_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          name: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      place_events: {
        Row: {
          city_id: string | null
          created_at: string
          id: number
          kind: string
          place_id: string
          user_id: string
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          id?: never
          kind: string
          place_id: string
          user_id: string
        }
        Update: {
          city_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photos: {
        Row: {
          attribution_name: string | null
          attribution_uri: string | null
          height_px: number | null
          id: string
          is_cover: boolean
          is_hidden: boolean
          photo_ref: string | null
          photo_uri: string | null
          place_id: string
          sort_order: number
          source: string
          storage_path: string | null
          width_px: number | null
        }
        Insert: {
          attribution_name?: string | null
          attribution_uri?: string | null
          height_px?: number | null
          id?: string
          is_cover?: boolean
          is_hidden?: boolean
          photo_ref?: string | null
          photo_uri?: string | null
          place_id: string
          sort_order?: number
          source?: string
          storage_path?: string | null
          width_px?: number | null
        }
        Update: {
          attribution_name?: string | null
          attribution_uri?: string | null
          height_px?: number | null
          id?: string
          is_cover?: boolean
          is_hidden?: boolean
          photo_ref?: string | null
          photo_uri?: string | null
          place_id?: string
          sort_order?: number
          source?: string
          storage_path?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          added_by: string | null
          address: string | null
          categories: string[]
          category: string
          channel: string | null
          city_id: string
          created_at: string
          desc_en: string | null
          desc_ja: string | null
          desc_vi: string | null
          duration_max: number | null
          duration_min: number | null
          emoji: string | null
          google_place_id: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          lat: number | null
          lng: number | null
          name_en: string
          name_ja: string | null
          name_vi: string
          needs_classification: boolean | null
          neighborhood_en: string | null
          neighborhood_ja: string | null
          neighborhood_vi: string | null
          opening_hours: Json | null
          phone: string | null
          price_display: string | null
          price_level: string | null
          price_vnd: number | null
          primary_type: string | null
          rating: number | null
          rating_count: number | null
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          saved_count: number
          slug: string
          sort_order: number | null
          submitted_by: string | null
          threads_handle: string | null
          updated_at: string
          vibe_tags: string[]
          website: string | null
        }
        Insert: {
          added_by?: string | null
          address?: string | null
          categories?: string[]
          category: string
          channel?: string | null
          city_id?: string
          created_at?: string
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          duration_max?: number | null
          duration_min?: number | null
          emoji?: string | null
          google_place_id?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name_en: string
          name_ja?: string | null
          name_vi: string
          needs_classification?: boolean | null
          neighborhood_en?: string | null
          neighborhood_ja?: string | null
          neighborhood_vi?: string | null
          opening_hours?: Json | null
          phone?: string | null
          price_display?: string | null
          price_level?: string | null
          price_vnd?: number | null
          primary_type?: string | null
          rating?: number | null
          rating_count?: number | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          saved_count?: number
          slug: string
          sort_order?: number | null
          submitted_by?: string | null
          threads_handle?: string | null
          updated_at?: string
          vibe_tags?: string[]
          website?: string | null
        }
        Update: {
          added_by?: string | null
          address?: string | null
          categories?: string[]
          category?: string
          channel?: string | null
          city_id?: string
          created_at?: string
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          duration_max?: number | null
          duration_min?: number | null
          emoji?: string | null
          google_place_id?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name_en?: string
          name_ja?: string | null
          name_vi?: string
          needs_classification?: boolean | null
          neighborhood_en?: string | null
          neighborhood_ja?: string | null
          neighborhood_vi?: string | null
          opening_hours?: Json | null
          phone?: string | null
          price_display?: string | null
          price_level?: string | null
          price_vnd?: number | null
          primary_type?: string | null
          rating?: number | null
          rating_count?: number | null
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          saved_count?: number
          slug?: string
          sort_order?: number | null
          submitted_by?: string | null
          threads_handle?: string | null
          updated_at?: string
          vibe_tags?: string[]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          budget_vnd: number | null
          categories: string[]
          history_on: boolean
          owner_id: string
          updated_at: string
        }
        Insert: {
          budget_vnd?: number | null
          categories?: string[]
          history_on?: boolean
          owner_id: string
          updated_at?: string
        }
        Update: {
          budget_vnd?: number | null
          categories?: string[]
          history_on?: boolean
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string
          bio: string
          created_at: string
          full_name: string
          handle: string
          id: string
          interests: string
          location: string
        }
        Insert: {
          avatar_url?: string
          bio?: string
          created_at?: string
          full_name?: string
          handle: string
          id: string
          interests?: string
          location?: string
        }
        Update: {
          avatar_url?: string
          bio?: string
          created_at?: string
          full_name?: string
          handle?: string
          id?: string
          interests?: string
          location?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          note: string | null
          reason: string
          reporter: string | null
          status: string
          target_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: string
          note?: string | null
          reason: string
          reporter?: string | null
          status?: string
          target_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          note?: string | null
          reason?: string
          reporter?: string | null
          status?: string
          target_id?: string
        }
        Relationships: []
      }
      reserved_handles: {
        Row: {
          handle: string
          reason: string
        }
        Insert: {
          handle: string
          reason?: string
        }
        Update: {
          handle?: string
          reason?: string
        }
        Relationships: []
      }
      startup_traces: {
        Row: {
          created_at: string
          id: string
          is_dev: boolean
          marks: Json
          os_version: string | null
          platform: string
          total_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_dev?: boolean
          marks: Json
          os_version?: string | null
          platform: string
          total_ms: number
        }
        Update: {
          created_at?: string
          id?: string
          is_dev?: boolean
          marks?: Json
          os_version?: string | null
          platform?: string
          total_ms?: number
        }
        Relationships: []
      }
      trip_invites: {
        Row: {
          created_at: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          arrive_min: number | null
          dwell_min: number | null
          place_id: string
          sort_order: number
          trip_id: string
          why: string | null
          why_lang: string | null
        }
        Insert: {
          arrive_min?: number | null
          dwell_min?: number | null
          place_id: string
          sort_order?: number
          trip_id: string
          why?: string | null
          why_lang?: string | null
        }
        Update: {
          arrive_min?: number | null
          dwell_min?: number | null
          place_id?: string
          sort_order?: number
          trip_id?: string
          why?: string | null
          why_lang?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          at_lat: number | null
          at_lng: number | null
          categories: string[]
          city_id: string
          company: string | null
          created_at: string
          day: string
          district: string | null
          generated_by: string
          id: string
          owner_id: string
          title: string
          updated_at: string
          when_part: string
        }
        Insert: {
          at_lat?: number | null
          at_lng?: number | null
          categories?: string[]
          city_id: string
          company?: string | null
          created_at?: string
          day: string
          district?: string | null
          generated_by?: string
          id?: string
          owner_id: string
          title?: string
          updated_at?: string
          when_part: string
        }
        Update: {
          at_lat?: number | null
          at_lng?: number | null
          categories?: string[]
          city_id?: string
          company?: string | null
          created_at?: string
          day?: string
          district?: string | null
          generated_by?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
          when_part?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      block_user: { Args: { target: string }; Returns: undefined }
      blocked_with: { Args: { other: string }; Returns: boolean }
      collection_has_unlive_member: { Args: { cid: string }; Returns: boolean }
      collection_like_counts: {
        Args: never
        Returns: {
          collection_id: string
          likes: number
        }[]
      }
      is_blocked_pair: { Args: { a: string; b: string }; Returns: boolean }
      is_editor: { Args: never; Returns: boolean }
      likes_on_mine: {
        Args: { since: string }
        Returns: {
          collection_id: string
          liked_at: string
          liker_handle: string
          liker_name: string
        }[]
      }
      moderate_collection: {
        Args: { hide: boolean; target: string }
        Returns: undefined
      }
      moderate_profile: {
        Args: {
          clear_avatar?: boolean
          clear_bio?: boolean
          clear_name?: boolean
          target: string
        }
        Returns: undefined
      }
      mutual_saves_counts: {
        Args: { others: string[] }
        Returns: {
          mutual: number
          other: string
        }[]
      }
      my_reports_today: { Args: never; Returns: number }
      on_trip: { Args: { t: string }; Returns: boolean }
      own_collection_places_today: { Args: never; Returns: number }
      random_handle: { Args: never; Returns: string }
      reports_queue: {
        Args: never
        Returns: {
          body: string
          created_at: string
          id: string
          kind: string
          note: string
          owner_handle: string
          owner_id: string
          reason: string
          status: string
          target_id: string
          title: string
        }[]
      }
      suggested_friends: {
        Args: never
        Returns: {
          mutual: number
          other: string
        }[]
      }
      trip_crew_counts: {
        Args: { trip_ids: string[] }
        Returns: {
          accepted: number
          pending: number
          trip_id: string
        }[]
      }
      trip_invite_count: { Args: { t: string }; Returns: number }
    }
    Enums: {
      collection_visibility: "public" | "private" | "shared"
      place_status:
        | "candidate"
        | "enriched"
        | "classified"
        | "verified"
        | "published"
        | "needs_reverify"
        | "archived"
      suit: "friends" | "family" | "couple"
      time_slot: "morning" | "afternoon" | "evening"
      vibe:
        | "cafes"
        | "food-tour"
        | "outdoors"
        | "views"
        | "culture"
        | "shopping"
        | "nightlife"
        | "chill"
        | "active"
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
      collection_visibility: ["public", "private", "shared"],
      place_status: [
        "candidate",
        "enriched",
        "classified",
        "verified",
        "published",
        "needs_reverify",
        "archived",
      ],
      suit: ["friends", "family", "couple"],
      time_slot: ["morning", "afternoon", "evening"],
      vibe: [
        "cafes",
        "food-tour",
        "outdoors",
        "views",
        "culture",
        "shopping",
        "nightlife",
        "chill",
        "active",
      ],
    },
  },
} as const
