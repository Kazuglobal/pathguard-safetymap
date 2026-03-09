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
      address_municipalities: {
        Row: {
          created_at: string
          is_designated_city: boolean
          municipality_code: string
          name_en: string
          name_ja: string
          name_kana: string | null
          prefecture_code: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_designated_city?: boolean
          municipality_code: string
          name_en: string
          name_ja: string
          name_kana?: string | null
          prefecture_code: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_designated_city?: boolean
          municipality_code?: string
          name_en?: string
          name_ja?: string
          name_kana?: string | null
          prefecture_code?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_municipalities_prefecture_code_fkey"
            columns: ["prefecture_code"]
            isOneToOne: false
            referencedRelation: "address_prefectures"
            referencedColumns: ["code"]
          },
        ]
      }
      address_prefectures: {
        Row: {
          code: number
          created_at: string
          name_en: string
          name_ja: string
          name_kana: string
          region: string
          updated_at: string
        }
        Insert: {
          code: number
          created_at?: string
          name_en: string
          name_ja: string
          name_kana: string
          region: string
          updated_at?: string
        }
        Update: {
          code?: number
          created_at?: string
          name_en?: string
          name_ja?: string
          name_kana?: string
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          context_id: string | null
          context_type: string
          created_at: string | null
          id: string
          prompt: string
          response_json: Json
        }
        Insert: {
          context_id?: string | null
          context_type: string
          created_at?: string | null
          id?: string
          prompt: string
          response_json: Json
        }
        Update: {
          context_id?: string | null
          context_type?: string
          created_at?: string | null
          id?: string
          prompt?: string
          response_json?: Json
        }
        Relationships: []
      }
      ai_simulations: {
        Row: {
          created_at: string | null
          id: string
          risk_score: number | null
          simulation_type: string
          spot_id: string
          status: string | null
          storage_path: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          risk_score?: number | null
          simulation_type: string
          spot_id: string
          status?: string | null
          storage_path: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          risk_score?: number | null
          simulation_type?: string
          spot_id?: string
          status?: string | null
          storage_path?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_simulations_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "danger_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      api_budget_settings: {
        Row: {
          alert_threshold_percent: number | null
          api_provider: string
          id: string
          monthly_budget_usd: number | null
          updated_at: string | null
        }
        Insert: {
          alert_threshold_percent?: number | null
          api_provider: string
          id?: string
          monthly_budget_usd?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_threshold_percent?: number | null
          api_provider?: string
          id?: string
          monthly_budget_usd?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_endpoint: string
          api_provider: string
          created_at: string | null
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          input_tokens: number | null
          model_name: string | null
          output_tokens: number | null
          request_count: number | null
          success: boolean | null
        }
        Insert: {
          api_endpoint: string
          api_provider: string
          created_at?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_tokens?: number | null
          request_count?: number | null
          success?: boolean | null
        }
        Update: {
          api_endpoint?: string
          api_provider?: string
          created_at?: string | null
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          input_tokens?: number | null
          model_name?: string | null
          output_tokens?: number | null
          request_count?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string | null
          icon: string | null
          id: number
          name: string
          threshold: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: number
          name: string
          threshold?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: number
          name?: string
          threshold?: number | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_official: boolean | null
          spot_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          spot_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_official?: boolean | null
          spot_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "danger_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      danger_reports: {
        Row: {
          accident_risk_score: number | null
          accident_stats: Json | null
          address_hash: string | null
          city: string | null
          created_at: string | null
          danger_level: number
          danger_type: string
          description: string | null
          geocode_confidence: number | null
          geocode_source: Database["public"]["Enums"]["geocode_provider"] | null
          geocoded_at: string | null
          id: string
          image_url: string | null
          latitude: number
          longitude: number
          municipality_code: string | null
          postal_code: string | null
          prefecture: string | null
          prefecture_code: number | null
          processed_image_url: string | null
          processed_image_urls: string[] | null
          status: string
          title: string
          town: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accident_risk_score?: number | null
          accident_stats?: Json | null
          address_hash?: string | null
          city?: string | null
          created_at?: string | null
          danger_level: number
          danger_type: string
          description?: string | null
          geocode_confidence?: number | null
          geocode_source?:
            | Database["public"]["Enums"]["geocode_provider"]
            | null
          geocoded_at?: string | null
          id?: string
          image_url?: string | null
          latitude: number
          longitude: number
          municipality_code?: string | null
          postal_code?: string | null
          prefecture?: string | null
          prefecture_code?: number | null
          processed_image_url?: string | null
          processed_image_urls?: string[] | null
          status?: string
          title: string
          town?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accident_risk_score?: number | null
          accident_stats?: Json | null
          address_hash?: string | null
          city?: string | null
          created_at?: string | null
          danger_level?: number
          danger_type?: string
          description?: string | null
          geocode_confidence?: number | null
          geocode_source?:
            | Database["public"]["Enums"]["geocode_provider"]
            | null
          geocoded_at?: string | null
          id?: string
          image_url?: string | null
          latitude?: number
          longitude?: number
          municipality_code?: string | null
          postal_code?: string | null
          prefecture?: string | null
          prefecture_code?: number | null
          processed_image_url?: string | null
          processed_image_urls?: string[] | null
          status?: string
          title?: string
          town?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "danger_reports_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "address_municipalities"
            referencedColumns: ["municipality_code"]
          },
          {
            foreignKeyName: "danger_reports_prefecture_code_fkey"
            columns: ["prefecture_code"]
            isOneToOne: false
            referencedRelation: "address_prefectures"
            referencedColumns: ["code"]
          },
        ]
      }
      danger_spots: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          id: string
          location: unknown
          risk_level: number | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location: unknown
          risk_level?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: unknown
          risk_level?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "danger_spots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diaries: {
        Row: {
          body_md: string
          created_at: string | null
          id: string
          log_date: string
          player_id: string | null
          title: string
        }
        Insert: {
          body_md: string
          created_at?: string | null
          id?: string
          log_date: string
          player_id?: string | null
          title: string
        }
        Update: {
          body_md?: string
          created_at?: string | null
          id?: string
          log_date?: string
          player_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "diaries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_comments: {
        Row: {
          body_md: string
          commenter_id: string | null
          created_at: string | null
          diary_id: string | null
          id: string
          role: string
        }
        Insert: {
          body_md: string
          commenter_id?: string | null
          created_at?: string | null
          diary_id?: string | null
          id?: string
          role: string
        }
        Update: {
          body_md?: string
          commenter_id?: string | null
          created_at?: string | null
          diary_id?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_comments_diary_id_fkey"
            columns: ["diary_id"]
            isOneToOne: false
            referencedRelation: "diaries"
            referencedColumns: ["id"]
          },
        ]
      }
      disaster_types: {
        Row: {
          description: string | null
          icon_path: string | null
          id: number
          name: string
        }
        Insert: {
          description?: string | null
          icon_path?: string | null
          id?: number
          name: string
        }
        Update: {
          description?: string | null
          icon_path?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      hazard_categories: {
        Row: {
          created_at: string | null
          description_ja: string | null
          icon: string | null
          id: string
          is_child_specific: boolean | null
          name_en: string
          name_ja: string
          severity_weight: number | null
        }
        Insert: {
          created_at?: string | null
          description_ja?: string | null
          icon?: string | null
          id: string
          is_child_specific?: boolean | null
          name_en: string
          name_ja: string
          severity_weight?: number | null
        }
        Update: {
          created_at?: string | null
          description_ja?: string | null
          icon?: string | null
          id?: string
          is_child_specific?: boolean | null
          name_en?: string
          name_ja?: string
          severity_weight?: number | null
        }
        Relationships: []
      }
      hazard_game_sessions: {
        Row: {
          analysis_result: Json
          created_at: string
          hazards_detected: number
          id: string
          overall_safety: number
          score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_result: Json
          created_at?: string
          hazards_detected?: number
          id?: string
          overall_safety?: number
          score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_result?: Json
          created_at?: string
          hazards_detected?: number
          id?: string
          overall_safety?: number
          score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_events: {
        Row: {
          created_at: string
          end_at: string | null
          event_key: string
          geom: unknown
          id: string
          props: Json
          severity: number
          source_id: string
          start_at: string | null
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          event_key: string
          geom?: unknown
          id?: string
          props?: Json
          severity?: number
          source_id: string
          start_at?: string | null
        }
        Update: {
          created_at?: string
          end_at?: string | null
          event_key?: string
          geom?: unknown
          id?: string
          props?: Json
          severity?: number
          source_id?: string
          start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hub_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_features: {
        Row: {
          created_at: string
          geom: unknown
          id: string
          layer_key: string
          observed_at: string | null
          props: Json
          source_id: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          geom: unknown
          id?: string
          layer_key: string
          observed_at?: string | null
          props?: Json
          source_id: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          geom?: unknown
          id?: string
          layer_key?: string
          observed_at?: string | null
          props?: Json
          source_id?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_features_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hub_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_sources: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kind: string
          municipality_code: string | null
          name: string
          refresh_cron: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          municipality_code?: string | null
          name: string
          refresh_cron?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          municipality_code?: string | null
          name?: string
          refresh_cron?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          period: string | null
          reward_badge_id: string | null
          reward_points: number | null
          target_type: string | null
          target_value: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          period?: string | null
          reward_badge_id?: string | null
          reward_points?: number | null
          target_type?: string | null
          target_value?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          period?: string | null
          reward_badge_id?: string | null
          reward_points?: number | null
          target_type?: string | null
          target_value?: number | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string | null
          grade: string
          handedness: string | null
          height_cm: number | null
          id: string
          name: string
          position: string
          team_id: string | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          grade: string
          handedness?: string | null
          height_cm?: number | null
          id?: string
          name: string
          position: string
          team_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          grade?: string
          handedness?: string | null
          height_cm?: number | null
          id?: string
          name?: string
          position?: string
          team_id?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      report_bookmarks: {
        Row: {
          created_at: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_bookmarks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_bookmarks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_bookmarks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      danger_report_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "danger_report_reactions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "danger_report_reactions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "danger_report_reactions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_edited: boolean
          parent_comment_id: string | null
          report_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          report_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          parent_comment_id?: string | null
          report_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "report_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_images: {
        Row: {
          created_at: string
          id: string
          image_type: string | null
          image_url: string
          report_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_type?: string | null
          image_url: string
          report_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_type?: string | null
          image_url?: string
          report_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_images_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_images_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_images_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_likes: {
        Row: {
          created_at: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_likes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_likes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_likes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_notifications: {
        Row: {
          actor_user_id: string | null
          created_at: string
          id: string
          is_read: boolean
          notification_type: string
          report_id: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type: string
          report_id: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          notification_type?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      report_shares: {
        Row: {
          created_at: string
          id: string
          platform: Database["public"]["Enums"]["share_platform"]
          report_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          platform: Database["public"]["Enums"]["share_platform"]
          report_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          platform?: Database["public"]["Enums"]["share_platform"]
          report_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_shares_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_shares_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      spot_disaster_types: {
        Row: {
          disaster_type_id: number
          spot_id: string
        }
        Insert: {
          disaster_type_id: number
          spot_id: string
        }
        Update: {
          disaster_type_id?: number
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_disaster_types_disaster_type_id_fkey"
            columns: ["disaster_type_id"]
            isOneToOne: false
            referencedRelation: "disaster_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spot_disaster_types_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "danger_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spot_photos: {
        Row: {
          created_at: string | null
          id: string
          is_original: boolean | null
          spot_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_original?: boolean | null
          spot_id: string
          storage_path: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_original?: boolean | null
          spot_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_photos_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "danger_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          founded_year: string | null
          id: string
          name: string
          region: string
        }
        Insert: {
          created_at?: string | null
          founded_year?: string | null
          id?: string
          name: string
          region: string
        }
        Update: {
          created_at?: string | null
          founded_year?: string | null
          id?: string
          name?: string
          region?: string
        }
        Relationships: []
      }
      traffic_accidents: {
        Row: {
          accident_type_code: string | null
          accident_type_label: string | null
          day_night_code: number | null
          day_of_week: number | null
          fatalities: number | null
          id: number
          imported_at: string | null
          injuries: number | null
          involves_child: boolean | null
          involves_pedestrian: boolean | null
          latitude: number
          location: unknown
          longitude: number
          municipality_code: string | null
          occurred_at: string | null
          party_a_age: number | null
          party_a_type_code: string | null
          party_b_age: number | null
          party_b_type_code: string | null
          police_station_code: string
          prefecture_code: number
          record_number: string
          road_shape_code: string | null
          road_shape_label: string | null
          road_surface_code: number | null
          road_width_code: string | null
          severity_code: number | null
          sidewalk_code: string | null
          sidewalk_label: string | null
          signal_code: string | null
          source_year: number
          terrain_code: number | null
          weather_code: number | null
          weather_label: string | null
          zone_regulation_code: string | null
        }
        Insert: {
          accident_type_code?: string | null
          accident_type_label?: string | null
          day_night_code?: number | null
          day_of_week?: number | null
          fatalities?: number | null
          id?: never
          imported_at?: string | null
          injuries?: number | null
          involves_child?: boolean | null
          involves_pedestrian?: boolean | null
          latitude: number
          location?: unknown
          longitude: number
          municipality_code?: string | null
          occurred_at?: string | null
          party_a_age?: number | null
          party_a_type_code?: string | null
          party_b_age?: number | null
          party_b_type_code?: string | null
          police_station_code: string
          prefecture_code: number
          record_number: string
          road_shape_code?: string | null
          road_shape_label?: string | null
          road_surface_code?: number | null
          road_width_code?: string | null
          severity_code?: number | null
          sidewalk_code?: string | null
          sidewalk_label?: string | null
          signal_code?: string | null
          source_year: number
          terrain_code?: number | null
          weather_code?: number | null
          weather_label?: string | null
          zone_regulation_code?: string | null
        }
        Update: {
          accident_type_code?: string | null
          accident_type_label?: string | null
          day_night_code?: number | null
          day_of_week?: number | null
          fatalities?: number | null
          id?: never
          imported_at?: string | null
          injuries?: number | null
          involves_child?: boolean | null
          involves_pedestrian?: boolean | null
          latitude?: number
          location?: unknown
          longitude?: number
          municipality_code?: string | null
          occurred_at?: string | null
          party_a_age?: number | null
          party_a_type_code?: string | null
          party_b_age?: number | null
          party_b_type_code?: string | null
          police_station_code?: string
          prefecture_code?: number
          record_number?: string
          road_shape_code?: string | null
          road_shape_label?: string | null
          road_surface_code?: number | null
          road_width_code?: string | null
          severity_code?: number | null
          sidewalk_code?: string | null
          sidewalk_label?: string | null
          signal_code?: string | null
          source_year?: number
          terrain_code?: number | null
          weather_code?: number | null
          weather_label?: string | null
          zone_regulation_code?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          acquired_at: string | null
          badge_id: number
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          badge_id: number
          user_id: string
        }
        Update: {
          acquired_at?: string | null
          badge_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mission_progress: {
        Row: {
          completed: boolean | null
          mission_id: number
          progress: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          mission_id: number
          progress?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          mission_id?: number
          progress?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          level: number
          points: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          level?: number
          points?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          level?: number
          points?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_routes: {
        Row: {
          created_at: string
          description: string | null
          distance_meters: number | null
          end_address: string
          end_lat: number
          end_lng: number
          estimated_time_minutes: number | null
          id: string
          is_favorite: boolean
          name: string
          route_geometry: Json | null
          start_address: string
          start_lat: number
          start_lng: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          distance_meters?: number | null
          end_address: string
          end_lat: number
          end_lng: number
          estimated_time_minutes?: number | null
          id?: string
          is_favorite?: boolean
          name: string
          route_geometry?: Json | null
          start_address: string
          start_lat: number
          start_lng: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          distance_meters?: number | null
          end_address?: string
          end_lat?: number
          end_lng?: number
          estimated_time_minutes?: number | null
          id?: string
          is_favorite?: boolean
          name?: string
          route_geometry?: Json | null
          start_address?: string
          start_lat?: number
          start_lng?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vlm_hazard_analyses: {
        Row: {
          analysis_duration_ms: number | null
          analysis_model: string
          analysis_prompt: string | null
          analyzed_by: string | null
          child_perspective_summary: string | null
          created_at: string
          error_message: string | null
          hazards: Json
          id: string
          image_storage_path: string | null
          image_url: string
          improvement_suggestions: Json | null
          overall_risk_level: number | null
          overall_safety_score: number | null
          report_id: string | null
          spot_id: string | null
          status: string
          time_weather_risks: Json | null
          token_usage: Json | null
          updated_at: string
        }
        Insert: {
          analysis_duration_ms?: number | null
          analysis_model?: string
          analysis_prompt?: string | null
          analyzed_by?: string | null
          child_perspective_summary?: string | null
          created_at?: string
          error_message?: string | null
          hazards?: Json
          id?: string
          image_storage_path?: string | null
          image_url: string
          improvement_suggestions?: Json | null
          overall_risk_level?: number | null
          overall_safety_score?: number | null
          report_id?: string | null
          spot_id?: string | null
          status?: string
          time_weather_risks?: Json | null
          token_usage?: Json | null
          updated_at?: string
        }
        Update: {
          analysis_duration_ms?: number | null
          analysis_model?: string
          analysis_prompt?: string | null
          analyzed_by?: string | null
          child_perspective_summary?: string | null
          created_at?: string
          error_message?: string | null
          hazards?: Json
          id?: string
          image_storage_path?: string | null
          image_url?: string
          improvement_suggestions?: Json | null
          overall_risk_level?: number | null
          overall_safety_score?: number | null
          report_id?: string | null
          spot_id?: string | null
          status?: string
          time_weather_risks?: Json | null
          token_usage?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlm_hazard_analyses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "danger_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlm_hazard_analyses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vlm_hazard_analyses_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "report_stats"
            referencedColumns: ["report_id"]
          },
          {
            foreignKeyName: "vlm_hazard_analyses_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "danger_spots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      danger_category_stats: {
        Row: {
          avg_danger_level: number | null
          danger_type: string | null
          latest_report_at: string | null
          monthly_reports: number | null
          total_reports: number | null
          unique_bookmarkers: number | null
          unique_commenters: number | null
          unique_likers: number | null
          weekly_reports: number | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      public_reports_with_stats: {
        Row: {
          address_hash: string | null
          bookmarks_count: number | null
          city: string | null
          comments_count: number | null
          created_at: string | null
          danger_level: number | null
          danger_type: string | null
          description: string | null
          geocode_confidence: number | null
          geocode_source: Database["public"]["Enums"]["geocode_provider"] | null
          geocoded_at: string | null
          id: string | null
          image_url: string | null
          latitude: number | null
          likes_count: number | null
          longitude: number | null
          municipality_code: string | null
          postal_code: string | null
          prefecture: string | null
          prefecture_code: number | null
          processed_image_url: string | null
          processed_image_urls: string[] | null
          shares_count: number | null
          status: string | null
          title: string | null
          town: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "danger_reports_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "address_municipalities"
            referencedColumns: ["municipality_code"]
          },
          {
            foreignKeyName: "danger_reports_prefecture_code_fkey"
            columns: ["prefecture_code"]
            isOneToOne: false
            referencedRelation: "address_prefectures"
            referencedColumns: ["code"]
          },
        ]
      }
      report_stats: {
        Row: {
          bookmarks_count: number | null
          comments_count: number | null
          created_at: string | null
          danger_level: number | null
          danger_type: string | null
          likes_count: number | null
          report_id: string | null
          shares_count: number | null
          status: string | null
        }
        Relationships: []
      }
      traffic_accident_summary: {
        Row: {
          child_accidents: number | null
          last_imported: string | null
          pedestrian_accidents: number | null
          prefecture_code: number | null
          source_year: number | null
          total_accidents: number | null
          total_fatalities: number | null
          total_injuries: number | null
        }
        Relationships: []
      }
      user_report_activity: {
        Row: {
          bookmarks_created: number | null
          comments_posted: number | null
          last_activity_at: string | null
          likes_given: number | null
          reports_created: number | null
          shares_made: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: Json
      }
      convert_npa_coordinate: {
        Args: { is_longitude?: boolean; raw_value: string }
        Returns: number
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_current_user_role: { Args: never; Returns: string }
      get_monthly_posts: {
        Args: never
        Returns: {
          count: number
          month: string
        }[]
      }
      get_nearby_accident_stats: {
        Args: {
          p_latitude: number
          p_longitude: number
          p_radius_meters?: number
          p_years?: number
        }
        Returns: Json
      }
      get_report_comments: { Args: { p_report_id: string }; Returns: Json[] }
      get_trending_reports: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json[]
      }
      get_user_bookmarked_reports: {
        Args: { p_user_id: string }
        Returns: Json[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      hub_get_events_geojson: {
        Args: {
          p_at_time?: string
          p_east: number
          p_event_keys: string[]
          p_north: number
          p_south: number
          p_west: number
        }
        Returns: Json
      }
      hub_get_features_geojson: {
        Args: {
          p_at_time?: string
          p_east: number
          p_layer_keys: string[]
          p_north: number
          p_south: number
          p_west: number
        }
        Returns: Json
      }
      increment_user_points: {
        Args: { p_delta: number; p_user_id: string }
        Returns: {
          level: number
          points: number
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      toggle_report_bookmark: {
        Args: { p_report_id: string; p_user_id: string }
        Returns: boolean
      }
      toggle_report_like: {
        Args: { p_report_id: string; p_user_id: string }
        Returns: boolean
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_mission_progress: {
        Args: {
          p_increment?: number
          p_mission_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      geocode_provider: "mapbox" | "gsi" | "osm" | "manual" | "batch"
      share_platform: "twitter" | "facebook" | "line" | "clipboard" | "other"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
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
      geocode_provider: ["mapbox", "gsi", "osm", "manual", "batch"],
      share_platform: ["twitter", "facebook", "line", "clipboard", "other"],
    },
  },
} as const
