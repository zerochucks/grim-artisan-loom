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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: string
          created_at: string
          generation_mode: string
          grid_data: Json | null
          height: number
          id: string
          image_url: string | null
          name: string
          palette_id: string | null
          prompt: string
          style_modifiers: string[] | null
          user_id: string
          width: number
        }
        Insert: {
          asset_type: string
          created_at?: string
          generation_mode?: string
          grid_data?: Json | null
          height: number
          id?: string
          image_url?: string | null
          name: string
          palette_id?: string | null
          prompt: string
          style_modifiers?: string[] | null
          user_id: string
          width: number
        }
        Update: {
          asset_type?: string
          created_at?: string
          generation_mode?: string
          grid_data?: Json | null
          height?: number
          id?: string
          image_url?: string | null
          name?: string
          palette_id?: string | null
          prompt?: string
          style_modifiers?: string[] | null
          user_id?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_palette_id_fkey"
            columns: ["palette_id"]
            isOneToOne: false
            referencedRelation: "palettes"
            referencedColumns: ["id"]
          },
        ]
      }
      palettes: {
        Row: {
          colors: string[]
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          colors: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          colors?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          default_palette_id: string | null
          default_resolution_h: number | null
          default_resolution_w: number | null
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_palette_id?: string | null
          default_resolution_h?: number | null
          default_resolution_w?: number | null
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_palette_id?: string | null
          default_resolution_h?: number | null
          default_resolution_w?: number | null
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_default_palette_id_fkey"
            columns: ["default_palette_id"]
            isOneToOne: false
            referencedRelation: "palettes"
            referencedColumns: ["id"]
          },
        ]
      }
      sprite_assets: {
        Row: {
          approved: boolean
          asset_key: string
          created_at: string | null
          filter_mode: string
          frame_count: number
          id: string
          ppu: number
          storage_url: string | null
          target_h: number
          target_w: number
          tier: string
          unity_path: string
        }
        Insert: {
          approved?: boolean
          asset_key: string
          created_at?: string | null
          filter_mode?: string
          frame_count?: number
          id?: string
          ppu: number
          storage_url?: string | null
          target_h: number
          target_w: number
          tier: string
          unity_path: string
        }
        Update: {
          approved?: boolean
          asset_key?: string
          created_at?: string | null
          filter_mode?: string
          frame_count?: number
          id?: string
          ppu?: number
          storage_url?: string | null
          target_h?: number
          target_w?: number
          tier?: string
          unity_path?: string
        }
        Relationships: []
      }
      style_recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_builtin: boolean
          modifiers: string[]
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          modifiers?: string[]
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_builtin?: boolean
          modifiers?: string[]
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
