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
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billable_events: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          description: string | null
          id: string
          offer_id: string | null
        }
        Insert: {
          amount?: number
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          offer_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          offer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billable_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billable_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          billing_country: string | null
          billing_email: string
          business_email: string
          business_name: string
          business_number: string | null
          business_phone: string | null
          cancellation_policy_accepted: boolean
          city: string | null
          contact_name: string
          contact_role: string | null
          country: string
          created_at: string
          fee_acknowledged: boolean
          id: string
          lat: number | null
          lng: number | null
          nzbn: string | null
          payment_collection_method: string
          physical_address: string
          postcode: string | null
          region: string | null
          tax_identifier: string | null
          terms_accepted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          billing_country?: string | null
          billing_email: string
          business_email: string
          business_name: string
          business_number?: string | null
          business_phone?: string | null
          cancellation_policy_accepted?: boolean
          city?: string | null
          contact_name: string
          contact_role?: string | null
          country: string
          created_at?: string
          fee_acknowledged?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          nzbn?: string | null
          payment_collection_method?: string
          physical_address: string
          postcode?: string | null
          region?: string | null
          tax_identifier?: string | null
          terms_accepted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          billing_country?: string | null
          billing_email?: string
          business_email?: string
          business_name?: string
          business_number?: string | null
          business_phone?: string | null
          cancellation_policy_accepted?: boolean
          city?: string | null
          contact_name?: string
          contact_role?: string | null
          country?: string
          created_at?: string
          fee_acknowledged?: boolean
          id?: string
          lat?: number | null
          lng?: number | null
          nzbn?: string | null
          payment_collection_method?: string
          physical_address?: string
          postcode?: string | null
          region?: string | null
          tax_identifier?: string | null
          terms_accepted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          business_id: string | null
          business_user_id: string | null
          created_at: string
          guest_user_id: string
          id: string
          is_unlocked: boolean
          last_message_at: string | null
          offer_id: string
        }
        Insert: {
          business_id?: string | null
          business_user_id?: string | null
          created_at?: string
          guest_user_id: string
          id?: string
          is_unlocked?: boolean
          last_message_at?: string | null
          offer_id: string
        }
        Update: {
          business_id?: string | null
          business_user_id?: string | null
          created_at?: string
          guest_user_id?: string
          id?: string
          is_unlocked?: boolean
          last_message_at?: string | null
          offer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          admin_fee_amount: number
          booking_confirmed_at: string
          check_in_date: string
          check_out_date: string
          created_at: string
          description: string
          id: string
          invoice_id: string
          offer_id: string
          property_id: string
        }
        Insert: {
          admin_fee_amount: number
          booking_confirmed_at: string
          check_in_date: string
          check_out_date: string
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          offer_id: string
          property_id: string
        }
        Update: {
          admin_fee_amount?: number
          booking_confirmed_at?: string
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          offer_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          business_id: string
          gst_amount: number | null
          id: string
          invoice_number: string
          issued_at: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: string | null
          total_amount: number
        }
        Insert: {
          business_id: string
          gst_amount?: number | null
          id?: string
          invoice_number: string
          issued_at?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string | null
          total_amount: number
        }
        Update: {
          business_id?: string
          gst_amount?: number | null
          id?: string
          invoice_number?: string
          issued_at?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accessibility_needs: string | null
          adults: number
          amenities_required: string[] | null
          bcf_amount: number | null
          bcf_currency: string | null
          bcf_paid_at: string | null
          bcf_payment_status: string | null
          bcf_stripe_payment_id: string | null
          check_in_date: string
          check_out_date: string
          children: number
          confirmed_at: string | null
          counter_amount: number | null
          created_at: string
          currency: string | null
          fee_amount: number | null
          fee_currency: string | null
          fee_payment_status: string | null
          fee_settled_via: string | null
          guest_notes: string | null
          guest_user_id: string
          id: string
          invoice_id: string | null
          offer_amount: number
          payment_confirmed: boolean | null
          property_id: string
          response_token: string | null
          response_token_expires_at: string | null
          room_id: string | null
          status: Database["public"]["Enums"]["offer_status"]
          updated_at: string
        }
        Insert: {
          accessibility_needs?: string | null
          adults?: number
          amenities_required?: string[] | null
          bcf_amount?: number | null
          bcf_currency?: string | null
          bcf_paid_at?: string | null
          bcf_payment_status?: string | null
          bcf_stripe_payment_id?: string | null
          check_in_date: string
          check_out_date: string
          children?: number
          confirmed_at?: string | null
          counter_amount?: number | null
          created_at?: string
          currency?: string | null
          fee_amount?: number | null
          fee_currency?: string | null
          fee_payment_status?: string | null
          fee_settled_via?: string | null
          guest_notes?: string | null
          guest_user_id: string
          id?: string
          invoice_id?: string | null
          offer_amount: number
          payment_confirmed?: boolean | null
          property_id: string
          response_token?: string | null
          response_token_expires_at?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Update: {
          accessibility_needs?: string | null
          adults?: number
          amenities_required?: string[] | null
          bcf_amount?: number | null
          bcf_currency?: string | null
          bcf_paid_at?: string | null
          bcf_payment_status?: string | null
          bcf_stripe_payment_id?: string | null
          check_in_date?: string
          check_out_date?: string
          children?: number
          confirmed_at?: string | null
          counter_amount?: number | null
          created_at?: string
          currency?: string | null
          fee_amount?: number | null
          fee_currency?: string | null
          fee_payment_status?: string | null
          fee_settled_via?: string | null
          guest_notes?: string | null
          guest_user_id?: string
          id?: string
          invoice_id?: string | null
          offer_amount?: number
          payment_confirmed?: boolean | null
          property_id?: string
          response_token?: string | null
          response_token_expires_at?: string | null
          room_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[] | null
          area: string | null
          business_id: string | null
          city: string
          country: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_claimed: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          property_type: Database["public"]["Enums"]["property_type"]
          registration_status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          business_id?: string | null
          city: string
          country: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_claimed?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          property_type?: Database["public"]["Enums"]["property_type"]
          registration_status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area?: string | null
          business_id?: string | null
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_claimed?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          registration_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          amenities: string[] | null
          bed_configuration: string | null
          created_at: string
          description: string | null
          id: string
          max_adults: number
          max_children: number
          name: string
          property_id: string
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          bed_configuration?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_adults?: number
          max_children?: number
          name: string
          property_id: string
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          bed_configuration?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_adults?: number
          max_children?: number
          name?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      watchlists: {
        Row: {
          created_at: string
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlists_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_offer_by_token: {
        Args: { _offer_id: string; _token: string }
        Returns: {
          adults: number
          check_in_date: string
          check_out_date: string
          children: number
          counter_amount: number
          guest_notes: string
          guest_user_id: string
          id: string
          offer_amount: number
          property_id: string
          response_token: string
          response_token_expires_at: string
          room_id: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "guest" | "business"
      offer_status:
        | "pending"
        | "accepted"
        | "countered"
        | "declined"
        | "cancelled"
        | "confirmed"
        | "submitted"
      property_type:
        | "hotel"
        | "motel"
        | "hostel"
        | "apartment"
        | "house"
        | "cabin"
        | "resort"
        | "bnb"
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
      app_role: ["guest", "business"],
      offer_status: [
        "pending",
        "accepted",
        "countered",
        "declined",
        "cancelled",
        "confirmed",
        "submitted",
      ],
      property_type: [
        "hotel",
        "motel",
        "hostel",
        "apartment",
        "house",
        "cabin",
        "resort",
        "bnb",
      ],
    },
  },
} as const
