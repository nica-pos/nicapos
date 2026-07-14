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
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          id: string
          reason: string
          session_id: string
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          reason: string
          session_id: string
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          reason?: string
          session_id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_nio: number | null
          counted_usd: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_nio: number
          opening_usd: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_nio?: number | null
          counted_usd?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_nio?: number
          opening_usd?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_nio?: number | null
          counted_usd?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_nio?: number
          opening_usd?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_components: {
        Row: {
          combo_id: string
          component_id: string
          created_at: string
          id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          combo_id: string
          component_id: string
          created_at?: string
          id?: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          combo_id?: string
          component_id?: string
          created_at?: string
          id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_components_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_components_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          rate: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          rate: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          rate?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          invoice_footer: string | null
          ir_enabled: boolean
          ir_rate: number
          iva_enabled: boolean
          iva_rate: number
          legal_name: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          ir_enabled?: boolean
          ir_rate?: number
          iva_enabled?: boolean
          iva_rate?: number
          legal_name?: string | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          ir_enabled?: boolean
          ir_rate?: number
          iva_enabled?: boolean
          iva_rate?: number
          legal_name?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          avg_cost_usd: number
          balance_qty: number
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          product_id: string
          quantity: number
          reference: string | null
          tenant_id: string
          unit_cost_usd: number
        }
        Insert: {
          avg_cost_usd?: number
          balance_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          product_id: string
          quantity: number
          reference?: string | null
          tenant_id: string
          unit_cost_usd?: number
        }
        Update: {
          avg_cost_usd?: number
          balance_qty?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          product_id?: string
          quantity?: number
          reference?: string | null
          tenant_id?: string
          unit_cost_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_branches: number
          max_cashiers: number
          max_products: number
          name: string
          price_usd: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_branches?: number
          max_cashiers?: number
          max_products?: number
          name: string
          price_usd?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_branches?: number
          max_cashiers?: number
          max_products?: number
          name?: string
          price_usd?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_models: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_models_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          brand_id: string | null
          category: string | null
          category_id: string | null
          cost_usd: number
          created_at: string
          id: string
          is_active: boolean
          is_combo: boolean
          is_tax_exempt: boolean
          min_stock: number
          model: string | null
          model_id: string | null
          name: string
          price_usd: number
          sku: string | null
          stock: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_combo?: boolean
          is_tax_exempt?: boolean
          min_stock?: number
          model?: string | null
          model_id?: string | null
          name: string
          price_usd?: number
          sku?: string | null
          stock?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_combo?: boolean
          is_tax_exempt?: boolean
          min_stock?: number
          model?: string | null
          model_id?: string | null
          name?: string
          price_usd?: number
          sku?: string | null
          stock?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          category_id: string | null
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          product_id: string | null
          starts_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_id?: string | null
          starts_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string | null
          starts_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total_usd: number
          name: string
          product_id: string | null
          quantity: number
          sale_id: string
          tax_usd: number
          tenant_id: string
          unit_price_usd: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_usd?: number
          name: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          tax_usd?: number
          tenant_id: string
          unit_price_usd?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_usd?: number
          name?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          tax_usd?: number
          tenant_id?: string
          unit_price_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          sale_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          sale_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          sale_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          exchange_rate: number
          id: string
          sale_number: number
          session_id: string | null
          sold_by: string
          subtotal_usd: number
          tax_usd: number
          tenant_id: string
          total_usd: number
        }
        Insert: {
          created_at?: string
          exchange_rate?: number
          id?: string
          sale_number: number
          session_id?: string | null
          sold_by: string
          subtotal_usd?: number
          tax_usd?: number
          tenant_id: string
          total_usd?: number
        }
        Update: {
          created_at?: string
          exchange_rate?: number
          id?: string
          sale_number?: number
          session_id?: string | null
          sold_by?: string
          subtotal_usd?: number
          tax_usd?: number
          tenant_id?: string
          total_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audit_items: {
        Row: {
          audit_id: string
          counted_qty: number
          created_at: string
          id: string
          product_id: string
          system_qty: number
          tenant_id: string
        }
        Insert: {
          audit_id: string
          counted_qty?: number
          created_at?: string
          id?: string
          product_id: string
          system_qty?: number
          tenant_id: string
        }
        Update: {
          audit_id?: string
          counted_qty?: number
          created_at?: string
          id?: string
          product_id?: string
          system_qty?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_audit_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "stock_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audit_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_audits: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan_id: string | null
          primary_color: string
          ruc: string | null
          slug: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan_id?: string | null
          primary_color?: string
          ruc?: string | null
          slug: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan_id?: string | null
          primary_color?: string
          ruc?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      record_inventory_movement: {
        Args: {
          _movement_type: string
          _product_id: string
          _quantity: number
          _reference?: string
          _unit_cost?: number
        }
        Returns: {
          avg_cost_usd: number
          balance_qty: number
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          product_id: string
          quantity: number
          reference: string | null
          tenant_id: string
          unit_cost_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "inventory_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_tenant: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "user"
      subscription_status: "trial" | "active" | "suspended" | "cancelled"
      tenant_role: "owner" | "admin" | "cashier" | "accountant"
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
      app_role: ["superadmin", "user"],
      subscription_status: ["trial", "active", "suspended", "cancelled"],
      tenant_role: ["owner", "admin", "cashier", "accountant"],
    },
  },
} as const
