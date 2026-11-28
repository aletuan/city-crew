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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_flag_testers: {
        Row: {
          created_at: string
          key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          key: string
          user_id: string
        }
        Update: {
          created_at?: string
          key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_flag_testers_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "app_flags"
            referencedColumns: ["key"]
          },
        ]
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
      banned_words: {
        Row: {
          created_at: string
          word: string
        }
        Insert: {
          created_at?: string
          word: string
        }
        Update: {
          created_at?: string
          word?: string
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
      checkin_photos: {
        Row: {
          bytes: number
          checkin_id: string
          created_at: string
          height: number
          hidden_at: string | null
          hidden_by: string | null
          id: string
          path: string
          position: number
          uploaded_by: string | null
          user_id: string
          width: number
        }
        Insert: {
          bytes: number
          checkin_id: string
          created_at?: string
          height: number
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          path: string
          position: number
          uploaded_by?: string | null
          user_id: string
          width: number
        }
        Update: {
          bytes?: number
          checkin_id?: string
          created_at?: string
          height?: number
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          path?: string
          position?: number
          uploaded_by?: string | null
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      checkins: {
        Row: {
          at: string
          audience: string | null
          city_id: string | null
          created_at: string
          id: string
          note: string | null
          place_id: string
          user_id: string
        }
        Insert: {
          at?: string
          audience?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          place_id: string
          user_id: string
        }
        Update: {
          at?: string
          audience?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          center_lat: number
          center_lng: number
          hero_cta_en: string | null
          hero_cta_ja: string | null
          hero_cta_vi: string | null
          hero_cta_zh: string | null
          hero_cta_zh_hant: string | null
          hero_photo_credit: string | null
          hero_photo_credit_uri: string | null
          hero_photo_path: string | null
          hero_photo_uri: string | null
          hero_place_slug: string | null
          hero_sub_en: string | null
          hero_sub_ja: string | null
          hero_sub_vi: string | null
          hero_sub_zh: string | null
          hero_sub_zh_hant: string | null
          hero_title_en: string | null
          hero_title_ja: string | null
          hero_title_vi: string | null
          hero_title_zh: string | null
          hero_title_zh_hant: string | null
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
          tz: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          hero_cta_en?: string | null
          hero_cta_ja?: string | null
          hero_cta_vi?: string | null
          hero_cta_zh?: string | null
          hero_cta_zh_hant?: string | null
          hero_photo_credit?: string | null
          hero_photo_credit_uri?: string | null
          hero_photo_path?: string | null
          hero_photo_uri?: string | null
          hero_place_slug?: string | null
          hero_sub_en?: string | null
          hero_sub_ja?: string | null
          hero_sub_vi?: string | null
          hero_sub_zh?: string | null
          hero_sub_zh_hant?: string | null
          hero_title_en?: string | null
          hero_title_ja?: string | null
          hero_title_vi?: string | null
          hero_title_zh?: string | null
          hero_title_zh_hant?: string | null
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
          tz?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          hero_cta_en?: string | null
          hero_cta_ja?: string | null
          hero_cta_vi?: string | null
          hero_cta_zh?: string | null
          hero_cta_zh_hant?: string | null
          hero_photo_credit?: string | null
          hero_photo_credit_uri?: string | null
          hero_photo_path?: string | null
          hero_photo_uri?: string | null
          hero_place_slug?: string | null
          hero_sub_en?: string | null
          hero_sub_ja?: string | null
          hero_sub_vi?: string | null
          hero_sub_zh?: string | null
          hero_sub_zh_hant?: string | null
          hero_title_en?: string | null
          hero_title_ja?: string | null
          hero_title_vi?: string | null
          hero_title_zh?: string | null
          hero_title_zh_hant?: string | null
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
          tz?: string
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
      collection_shares: {
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
            foreignKeyName: "collection_shares_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_views: {
        Row: {
          collection_id: string
          day: string
          views: number
        }
        Insert: {
          collection_id: string
          day: string
          views: number
        }
        Update: {
          collection_id?: string
          day?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_views_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          city_id: string
          comments_off: boolean
          copied_from: string | null
          cover_photo_id: string | null
          created_at: string
          curator_handle: string | null
          desc_en: string | null
          desc_ja: string | null
          desc_vi: string | null
          id: string
          is_public: boolean
          kinds_added: string[]
          kinds_hidden: string[]
          owner_id: string | null
          slug: string
          sort_order: number | null
          title_en: string
          title_ja: string | null
          title_vi: string
        }
        Insert: {
          city_id?: string
          comments_off?: boolean
          copied_from?: string | null
          cover_photo_id?: string | null
          created_at?: string
          curator_handle?: string | null
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          id?: string
          is_public?: boolean
          kinds_added?: string[]
          kinds_hidden?: string[]
          owner_id?: string | null
          slug: string
          sort_order?: number | null
          title_en: string
          title_ja?: string | null
          title_vi: string
        }
        Update: {
          city_id?: string
          comments_off?: boolean
          copied_from?: string | null
          cover_photo_id?: string | null
          created_at?: string
          curator_handle?: string | null
          desc_en?: string | null
          desc_ja?: string | null
          desc_vi?: string | null
          id?: string
          is_public?: boolean
          kinds_added?: string[]
          kinds_hidden?: string[]
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
            foreignKeyName: "collections_copied_from_fkey"
            columns: ["copied_from"]
            isOneToOne: false
            referencedRelation: "collections"
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
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          at: number
          comment_id: string
          len: number
          person_id: string | null
          place_id: string | null
        }
        Insert: {
          at: number
          comment_id: string
          len: number
          person_id?: string | null
          place_id?: string | null
        }
        Update: {
          at?: number
          comment_id?: string
          len?: number
          person_id?: string | null
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author: string
          body: string
          collection_id: string | null
          created_at: string
          depth: number
          id: string
          parent_id: string | null
          root_id: string | null
        }
        Insert: {
          author: string
          body: string
          collection_id?: string | null
          created_at?: string
          depth?: number
          id?: string
          parent_id?: string | null
          root_id?: string | null
        }
        Update: {
          author?: string
          body?: string
          collection_id?: string | null
          created_at?: string
          depth?: number
          id?: string
          parent_id?: string | null
          root_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_root_id_fkey"
            columns: ["root_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_reviews: {
        Row: {
          cover_photo_id: string | null
          decided_at: string
          decided_by: string | null
          decision: string
          place_id: string
          suggested_photo_id: string | null
        }
        Insert: {
          cover_photo_id?: string | null
          decided_at?: string
          decided_by?: string | null
          decision: string
          place_id: string
          suggested_photo_id?: string | null
        }
        Update: {
          cover_photo_id?: string | null
          decided_at?: string
          decided_by?: string | null
          decision?: string
          place_id?: string
          suggested_photo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cover_reviews_cover_photo_id_fkey"
            columns: ["cover_photo_id"]
            isOneToOne: false
            referencedRelation: "place_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_reviews_suggested_photo_id_fkey"
            columns: ["suggested_photo_id"]
            isOneToOne: false
            referencedRelation: "place_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_traces: {
        Row: {
          channel: string | null
          created_at: string
          events: Json
          id: string
          is_dev: boolean
          options: number
          os_version: string | null
          platform: string
          span: number
          still: boolean
          total_ms: number
        }
        Insert: {
          channel?: string | null
          created_at?: string
          events: Json
          id?: string
          is_dev?: boolean
          options: number
          os_version?: string | null
          platform: string
          span: number
          still?: boolean
          total_ms: number
        }
        Update: {
          channel?: string | null
          created_at?: string
          events?: Json
          id?: string
          is_dev?: boolean
          options?: number
          os_version?: string | null
          platform?: string
          span?: number
          still?: boolean
          total_ms?: number
        }
        Relationships: []
      }
      editorial_collection_origin: {
        Row: {
          collection_id: string
          moved_at: string
          previous_curator_handle: string | null
          previous_owner_id: string
        }
        Insert: {
          collection_id: string
          moved_at?: string
          previous_curator_handle?: string | null
          previous_owner_id: string
        }
        Update: {
          collection_id?: string
          moved_at?: string
          previous_curator_handle?: string | null
          previous_owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_collection_origin_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: true
            referencedRelation: "collections"
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
      fetch_place_calls: {
        Row: {
          action: string
          day: string
          day_cap: number
          n: number
          user_cap: number | null
          user_id: string
        }
        Insert: {
          action: string
          day: string
          day_cap: number
          n?: number
          user_cap?: number | null
          user_id: string
        }
        Update: {
          action?: string
          day?: string
          day_cap?: number
          n?: number
          user_cap?: number | null
          user_id?: string
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
      local_guides: {
        Row: {
          added_at: string
          added_by: string | null
          city_id: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          city_id?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          city_id?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_guides_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
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
      photo_scores: {
        Row: {
          aesthetic: number | null
          is_utility: boolean | null
          photo_id: string
          scored_at: string
          scored_by: string | null
          scorer: string
          scorer_version: number
          signals: Json
        }
        Insert: {
          aesthetic?: number | null
          is_utility?: boolean | null
          photo_id: string
          scored_at?: string
          scored_by?: string | null
          scorer?: string
          scorer_version: number
          signals?: Json
        }
        Update: {
          aesthetic?: number | null
          is_utility?: boolean | null
          photo_id?: string
          scored_at?: string
          scored_by?: string | null
          scorer?: string
          scorer_version?: number
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "photo_scores_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "place_photos"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          height_px: number | null
          hidden_by: string | null
          id: string
          is_cover: boolean
          is_hidden: boolean
          photo_ref: string | null
          photo_uri: string | null
          place_id: string
          sort_order: number
          source: string
          storage_path: string | null
          uploaded_by: string | null
          width_px: number | null
        }
        Insert: {
          attribution_name?: string | null
          attribution_uri?: string | null
          created_at?: string
          height_px?: number | null
          hidden_by?: string | null
          id?: string
          is_cover?: boolean
          is_hidden?: boolean
          photo_ref?: string | null
          photo_uri?: string | null
          place_id: string
          sort_order?: number
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
          width_px?: number | null
        }
        Update: {
          attribution_name?: string | null
          attribution_uri?: string | null
          created_at?: string
          height_px?: number | null
          hidden_by?: string | null
          id?: string
          is_cover?: boolean
          is_hidden?: boolean
          photo_ref?: string | null
          photo_uri?: string | null
          place_id?: string
          sort_order?: number
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
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
          business_status: string | null
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
          google_phone: string | null
          google_place_id: string | null
          google_refreshed_at: string | null
          google_summary: string | null
          google_website: string | null
          i18n: Json
          id: string
          instagram_handle: string | null
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
          review_pace: number | null
          review_status: string
          reviewed_at: string | null
          reviewer_name: string | null
          reviewer_source: string | null
          reviewer_url: string | null
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
          business_status?: string | null
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
          google_phone?: string | null
          google_place_id?: string | null
          google_refreshed_at?: string | null
          google_summary?: string | null
          google_website?: string | null
          i18n?: Json
          id?: string
          instagram_handle?: string | null
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
          review_pace?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_name?: string | null
          reviewer_source?: string | null
          reviewer_url?: string | null
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
          business_status?: string | null
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
          google_phone?: string | null
          google_place_id?: string | null
          google_refreshed_at?: string | null
          google_summary?: string | null
          google_website?: string | null
          i18n?: Json
          id?: string
          instagram_handle?: string | null
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
          review_pace?: number | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_name?: string | null
          reviewer_source?: string | null
          reviewer_url?: string | null
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
      plan_assist_guest_calls: {
        Row: {
          day: string
          ip_hash: string
          n: number
        }
        Insert: {
          day: string
          ip_hash: string
          n?: number
        }
        Update: {
          day?: string
          ip_hash?: string
          n?: number
        }
        Relationships: []
      }
      preferences: {
        Row: {
          budget_vnd: number | null
          categories: string[]
          grid_notice_closed_at: string | null
          history_on: boolean
          owner_id: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          budget_vnd?: number | null
          categories?: string[]
          grid_notice_closed_at?: string | null
          history_on?: boolean
          owner_id: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          budget_vnd?: number | null
          categories?: string[]
          grid_notice_closed_at?: string | null
          history_on?: boolean
          owner_id?: string
          theme?: string | null
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
          wall_kind: string | null
          wall_ref: string | null
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
          wall_kind?: string | null
          wall_ref?: string | null
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
          wall_kind?: string | null
          wall_ref?: string | null
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
      suggestion_dismissals: {
        Row: {
          created_at: string
          other: string
          user_id: string
        }
        Insert: {
          created_at?: string
          other: string
          user_id: string
        }
        Update: {
          created_at?: string
          other?: string
          user_id?: string
        }
        Relationships: []
      }
      tab_traces: {
        Row: {
          channel: string | null
          created_at: string
          id: string
          is_dev: boolean
          os_version: string | null
          platform: string
          switches: Json
        }
        Insert: {
          channel?: string | null
          created_at?: string
          id?: string
          is_dev?: boolean
          os_version?: string | null
          platform: string
          switches: Json
        }
        Update: {
          channel?: string | null
          created_at?: string
          id?: string
          is_dev?: boolean
          os_version?: string | null
          platform?: string
          switches?: Json
        }
        Relationships: []
      }
      trip_collections: {
        Row: {
          collection_id: string
          trip_id: string
        }
        Insert: {
          collection_id: string
          trip_id: string
        }
        Update: {
          collection_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collections_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
      adopt_editorial_collections: {
        Args: { target_email: string }
        Returns: number
      }
      block_user: { Args: { target: string }; Returns: undefined }
      blocked_with: { Args: { other: string }; Returns: boolean }
      collection_like_counts: {
        Args: never
        Returns: {
          collection_id: string
          likes: number
          others: number
        }[]
      }
      collection_stats: {
        Args: { cid: string }
        Returns: {
          copies_7d: number
          copies_total: number
          likes_7d: number
          likes_total: number
          trips_7d: number
          trips_total: number
          views_7d: number
          views_total: number
        }[]
      }
      collection_copy_counts: {
        Args: never
        Returns: {
          copies: number
          slug: string
        }[]
      }
      collection_use_counts: {
        Args: never
        Returns: {
          liked: number
          slug: string
          uses: number
          views: number
        }[]
      }
      comment_clean: { Args: { p_body: string }; Returns: boolean }
      comment_news: {
        Args: { p_since: string }
        Returns: {
          actor: string
          at: string
          avatar_url: string
          body: string
          comment_id: string
          full_name: string
          handle: string
          kind: string
          list: Json
          others: number
        }[]
      }
      comment_previews: {
        Args: { p_collections: string[] }
        Returns: {
          collection_id: string
          latest: Json
          n: number
          off: boolean
        }[]
      }
      comment_subject_visible: {
        Args: { p_collection: string }
        Returns: boolean
      }
      comment_taggable: { Args: { p_collection: string }; Returns: Json }
      comment_thread: {
        Args: { p_collection: string; p_order?: string }
        Returns: {
          author: string
          avatar_url: string
          body: string
          created_at: string
          depth: number
          full_name: string
          handle: string
          id: string
          liked: boolean
          likes: number
          mentions: Json
          parent_id: string
          root_id: string
        }[]
      }
      comments_seen: {
        Args: { p_collections: string[] }
        Returns: {
          author: string
          body: string
          collection_id: string | null
          created_at: string
          depth: number
          id: string
          parent_id: string | null
          root_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "comments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      copies_of_list: {
        Args: { cid: string }
        Returns: {
          collection_id: string
          copied_at: string
          copier_avatar_url: string
          copier_handle: string
          copier_id: string
          copier_name: string
        }[]
      }
      copies_of_mine: {
        Args: { since: string }
        Returns: {
          collection_id: string
          copied_at: string
          copier_avatar_url: string
          copier_handle: string
          copier_id: string
          copier_name: string
        }[]
      }
      delete_comment: { Args: { p_id: string }; Returns: undefined }
      fetch_place_allowed: {
        Args: {
          p_action: string
          p_day_cap: number
          p_user: string
          p_user_cap: number
        }
        Returns: string
      }
      fetch_place_usage: { Args: never; Returns: Json }
      friend_suggestions: {
        Args: never
        Returns: {
          collection_id: string
          n: number
          other: string
          reason: string
        }[]
      }
      friends_with: { Args: { other: string }; Returns: boolean }
      guest_assist_allowed: {
        Args: { p_day_cap: number; p_ip_cap: number; p_ip_hash: string }
        Returns: boolean
      }
      guide_may_manage: { Args: { photo: string }; Returns: boolean }
      guide_set_cover: { Args: { photo: string }; Returns: undefined }
      guide_set_hidden: {
        Args: { hidden: boolean; photo: string }
        Returns: undefined
      }
      i18n_well_formed: { Args: { doc: Json }; Returns: boolean }
      is_blocked_pair: { Args: { a: string; b: string }; Returns: boolean }
      is_editor: { Args: never; Returns: boolean }
      is_local_guide:
        | { Args: never; Returns: boolean }
        | { Args: { p_city_id: string }; Returns: boolean }
      like_checkin: {
        Args: { p_id: string; p_on: boolean }
        Returns: undefined
      }
      like_comment: {
        Args: { p_id: string; p_on: boolean }
        Returns: undefined
      }
      person_checkins: {
        Args: { p_person: string }
        Returns: {
          audience: string
          categories: string[]
          city_id: string
          cover: string
          day: string
          i18n: Json
          id: string
          liked: boolean
          likes: number
          name_en: string
          name_vi: string
          hidden: boolean
          note: string
          note_hidden: boolean
          photos: Json
          place_slug: string
        }[]
      }
      place_guest_reviews: {
        Args: { p_slug: string }
        Returns: Json
      }
      featured_checkins: {
        Args: { p_city: string }
        Returns: Json
      }
      checkin_hearts_takeout: {
        Args: never
        Returns: {
          liked_at: string
          place_slug: string
        }[]
      }
      likes_on_list: {
        Args: { cid: string }
        Returns: {
          collection_id: string
          liked_at: string
          liker_avatar_url: string
          liker_handle: string
          liker_id: string
          liker_name: string
        }[]
      }
      likes_on_mine: {
        Args: { since: string }
        Returns: {
          collection_id: string
          liked_at: string
          liker_avatar_url: string
          liker_handle: string
          liker_id: string
          liker_name: string
        }[]
      }
      lists_liked_in_common: {
        Args: { other: string }
        Returns: {
          slug: string
        }[]
      }
      may_check_in: { Args: { p_place: string }; Returns: boolean }
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
      my_comment_takeout: { Args: never; Returns: Json }
      my_reports_today: { Args: never; Returns: number }
      on_trip: { Args: { t: string }; Returns: boolean }
      own_collection_places_today: { Args: never; Returns: number }
      own_collections_today: { Args: never; Returns: number }
      own_comments_today: { Args: never; Returns: number }
      own_friend_requests_today: { Args: never; Returns: number }
      own_photos_on_place: { Args: { target: string }; Returns: number }
      own_place_events_today: { Args: never; Returns: number }
      own_place_photos_today: { Args: never; Returns: number }
      owns_collection: { Args: { cid: string }; Returns: boolean }
      places_in_common: {
        Args: { other: string }
        Returns: {
          name_en: string
          name_ja: string
          name_vi: string
          photo_uri: string
          slug: string
        }[]
      }
      popular_themes: {
        Args: never
        Returns: {
          theme: string
        }[]
      }
      post_comment: {
        Args: {
          p_body: string
          p_collection: string
          p_mentions?: Json
          p_parent: string
        }
        Returns: string
      }
      random_avatar_preset: { Args: never; Returns: string }
      random_handle: { Args: never; Returns: string }
      record_collection_view: { Args: { cid: string }; Returns: undefined }
      reorder_collection: {
        Args: { collection_slug: string; place_slugs: string[] }
        Returns: undefined
      }
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
      role_of: { Args: { person: string }; Returns: string }
      shared_with_me: { Args: { cid: string }; Returns: boolean }
      strip_profile_metadata: { Args: { meta: Json }; Returns: Json }
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
      unshare_pair: { Args: { a: string; b: string }; Returns: undefined }
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
