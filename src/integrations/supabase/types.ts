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
      audit_logs: {
        Row: {
          action: string
          branch_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          branch_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          branch_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          currency: string
          id: string
          instructions: string | null
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type?: string
          bank_name: string
          created_at?: string
          currency: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          currency?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
          branch_id: string
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
          branch_id: string
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
          branch_id?: string
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
            foreignKeyName: "cash_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          branch_id: string
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
          branch_id: string
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
          branch_id?: string
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
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit_usd: number
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          ruc: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit_usd?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          ruc?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit_usd?: number
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          ruc?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
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
          invoice_prefix: string
          ir_enabled: boolean
          ir_rate: number
          iva_enabled: boolean
          iva_rate: number
          legal_name: string | null
          next_invoice_number: number
          next_proforma_number: number
          next_ticket_number: number
          phone: string | null
          proforma_prefix: string
          show_logo: boolean
          tenant_id: string
          thank_you_message: string | null
          ticket_header: string | null
          ticket_prefix: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_prefix?: string
          ir_enabled?: boolean
          ir_rate?: number
          iva_enabled?: boolean
          iva_rate?: number
          legal_name?: string | null
          next_invoice_number?: number
          next_proforma_number?: number
          next_ticket_number?: number
          phone?: string | null
          proforma_prefix?: string
          show_logo?: boolean
          tenant_id: string
          thank_you_message?: string | null
          ticket_header?: string | null
          ticket_prefix?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invoice_footer?: string | null
          invoice_prefix?: string
          ir_enabled?: boolean
          ir_rate?: number
          iva_enabled?: boolean
          iva_rate?: number
          legal_name?: string | null
          next_invoice_number?: number
          next_proforma_number?: number
          next_ticket_number?: number
          phone?: string | null
          proforma_prefix?: string
          show_logo?: boolean
          tenant_id?: string
          thank_you_message?: string | null
          ticket_header?: string | null
          ticket_prefix?: string
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
          branch_id: string
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
          branch_id: string
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
          branch_id?: string
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
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      layaway_items: {
        Row: {
          id: string
          layaway_id: string
          name: string
          product_id: string | null
          quantity: number
          tenant_id: string
          unit_price_usd: number
        }
        Insert: {
          id?: string
          layaway_id: string
          name: string
          product_id?: string | null
          quantity?: number
          tenant_id: string
          unit_price_usd?: number
        }
        Update: {
          id?: string
          layaway_id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          tenant_id?: string
          unit_price_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "layaway_items_layaway_id_fkey"
            columns: ["layaway_id"]
            isOneToOne: false
            referencedRelation: "layaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaway_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaway_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      layaway_payments: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          id: string
          layaway_id: string
          method: string
          note: string | null
          tenant_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          id?: string
          layaway_id: string
          method?: string
          note?: string | null
          tenant_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          layaway_id?: string
          method?: string
          note?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "layaway_payments_layaway_id_fkey"
            columns: ["layaway_id"]
            isOneToOne: false
            referencedRelation: "layaways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaway_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      layaways: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          id: string
          paid_usd: number
          status: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          paid_usd?: number
          status?: string
          tenant_id: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          paid_usd?: number
          status?: string
          tenant_id?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layaways_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaways_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layaways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payable_payments: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          note: string | null
          purchase_order_id: string
          tenant_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          purchase_order_id: string
          tenant_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          purchase_order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payable_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payable_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_settings: {
        Row: {
          client_id: string | null
          client_secret_ciphertext: string | null
          created_at: string
          id: string
          is_enabled: boolean
          mode: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          client_secret_ciphertext?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          mode?: string
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          client_secret_ciphertext?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          mode?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          id: string
          months_covered: number | null
          plan_id: string
          receipt_url: string
          reference: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          currency: string
          id?: string
          months_covered?: number | null
          plan_id: string
          receipt_url: string
          reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          months_covered?: number | null
          plan_id?: string
          receipt_url?: string
          reference?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_tenant_id_fkey"
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
      product_stock: {
        Row: {
          branch_id: string
          cost_usd: number
          product_id: string
          stock: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          cost_usd?: number
          product_id: string
          stock?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          cost_usd?: number
          product_id?: string
          stock?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_tenant_id_fkey"
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
          image_url: string | null
          is_active: boolean
          is_combo: boolean
          is_tax_exempt: boolean
          min_stock: number
          model: string | null
          model_id: string | null
          name: string
          price_currency: string
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
          image_url?: string | null
          is_active?: boolean
          is_combo?: boolean
          is_tax_exempt?: boolean
          min_stock?: number
          model?: string | null
          model_id?: string | null
          name: string
          price_currency?: string
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
          image_url?: string | null
          is_active?: boolean
          is_combo?: boolean
          is_tax_exempt?: boolean
          min_stock?: number
          model?: string | null
          model_id?: string | null
          name?: string
          price_currency?: string
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
      purchase_order_items: {
        Row: {
          id: string
          name: string
          product_id: string | null
          purchase_order_id: string
          quantity: number
          tenant_id: string
          unit_cost_usd: number
        }
        Insert: {
          id?: string
          name: string
          product_id?: string | null
          purchase_order_id: string
          quantity?: number
          tenant_id: string
          unit_cost_usd?: number
        }
        Update: {
          id?: string
          name?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity?: number
          tenant_id?: string
          unit_cost_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          paid_usd: number
          po_number: number
          received_at: string | null
          status: string
          supplier_id: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          paid_usd?: number
          po_number?: number
          received_at?: string | null
          status?: string
          supplier_id: string
          tenant_id: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          paid_usd?: number
          po_number?: number
          received_at?: string | null
          status?: string
          supplier_id?: string
          tenant_id?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receivable_payments: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          note: string | null
          receivable_id: string
          tenant_id: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          receivable_id: string
          tenant_id: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          note?: string | null
          receivable_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivable_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          paid_usd: number
          sale_id: string | null
          status: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_usd?: number
          sale_id?: string | null
          status?: string
          tenant_id: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          paid_usd?: number
          sale_id?: string | null
          status?: string
          tenant_id?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          order_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          order_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        Insert: {
          accessories?: string | null
          branch_id: string
          brand: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_exception_reason?: string | null
          diagnosis?: string | null
          estimated_delivery?: string | null
          id?: string
          imei?: string | null
          labor_usd?: number
          model: string
          observations?: string | null
          order_number: number
          paid_usd?: number
          parts_cost_usd?: number
          parts_usd?: number
          photo_paths?: string[]
          physical_condition?: string | null
          quote_status?: string
          reported_issue: string
          status?: string
          technician_id?: string | null
          tenant_id: string
          total_usd?: number
          updated_at?: string
          work_to_do?: string | null
        }
        Update: {
          accessories?: string | null
          branch_id?: string
          brand?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_exception_reason?: string | null
          diagnosis?: string | null
          estimated_delivery?: string | null
          id?: string
          imei?: string | null
          labor_usd?: number
          model?: string
          observations?: string | null
          order_number?: number
          paid_usd?: number
          parts_cost_usd?: number
          parts_usd?: number
          photo_paths?: string[]
          physical_condition?: string | null
          quote_status?: string
          reported_issue?: string
          status?: string
          technician_id?: string | null
          tenant_id?: string
          total_usd?: number
          updated_at?: string
          work_to_do?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_parts: {
        Row: {
          consumed: boolean
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          tenant_id: string
          unit_cost_usd: number
          unit_price_usd: number
        }
        Insert: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          order_id: string
          product_id?: string | null
          quantity: number
          tenant_id: string
          unit_cost_usd?: number
          unit_price_usd?: number
        }
        Update: {
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          tenant_id?: string
          unit_cost_usd?: number
          unit_price_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_payments: {
        Row: {
          amount: number
          amount_usd: number
          branch_id: string
          cash_session_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          exchange_rate: number
          id: string
          kind: string
          method: string
          order_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          amount_usd: number
          branch_id: string
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          exchange_rate?: number
          id?: string
          kind: string
          method: string
          order_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          amount_usd?: number
          branch_id?: string
          cash_session_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          exchange_rate?: number
          id?: string
          kind?: string
          method?: string
          order_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          labor_usd: number
          note: string | null
          order_id: string
          parts_usd: number
          status: string
          tenant_id: string
          total_usd: number
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          labor_usd?: number
          note?: string | null
          order_id: string
          parts_usd?: number
          status?: string
          tenant_id: string
          total_usd?: number
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          labor_usd?: number
          note?: string | null
          order_id?: string
          parts_usd?: number
          status?: string
          tenant_id?: string
          total_usd?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_secrets: {
        Row: {
          created_at: string
          order_id: string
          tenant_id: string
          unlock_code: string
        }
        Insert: {
          created_at?: string
          order_id: string
          tenant_id: string
          unlock_code: string
        }
        Update: {
          created_at?: string
          order_id?: string
          tenant_id?: string
          unlock_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_secrets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          tenant_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          tenant_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
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
          unit_cost_usd: number
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
          unit_cost_usd?: number
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
          unit_cost_usd?: number
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
          branch_id: string
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          branch_id: string
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          branch_id?: string
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
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          branch_id: string
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
          branch_id: string
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
          branch_id?: string
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
            foreignKeyName: "stock_audits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          status: string
          tenant_id: string
          to_branch_id: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          from_branch_id: string
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          received_at?: string | null
          received_by?: string | null
          status?: string
          tenant_id: string
          to_branch_id: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          from_branch_id?: string
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          received_at?: string | null
          received_by?: string | null
          status?: string
          tenant_id?: string
          to_branch_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          ruc: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          ruc?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          ruc?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status: string
          tenant_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tenant_role"]
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          plan_id: string | null
          provider: string
          raw: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          provider: string
          raw?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          raw?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
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
          cancellation_reason?: string | null
          cancelled_at?: string | null
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
      trial_requests: {
        Row: {
          approved_tenant_id: string | null
          business_name: string
          city: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          ip_address: string | null
          latitude: number | null
          location_accuracy: number | null
          longitude: number | null
          notes: string | null
          owner_user_id: string | null
          pending_tenant_id: string | null
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          approved_tenant_id?: string | null
          business_name: string
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          notes?: string | null
          owner_user_id?: string | null
          pending_tenant_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          approved_tenant_id?: string | null
          business_name?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          ip_address?: string | null
          latitude?: number | null
          location_accuracy?: number | null
          longitude?: number | null
          notes?: string | null
          owner_user_id?: string | null
          pending_tenant_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_requests_approved_tenant_id_fkey"
            columns: ["approved_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_requests_pending_tenant_id_fkey"
            columns: ["pending_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      _repair_guard: {
        Args: { _allow_accountant?: boolean; _order_id: string }
        Returns: Database["public"]["Enums"]["tenant_role"]
      }
      _repair_log: {
        Args: {
          _note: string
          _o: Database["public"]["Tables"]["repair_orders"]["Row"]
          _to: string
        }
        Returns: undefined
      }
      add_repair_note: {
        Args: { _note: string; _order_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          order_id: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repair_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_trial_request: {
        Args: {
          _owner_user_id: string
          _plan_id: string
          _request_id: string
          _tenant_name: string
          _trial_days: number
        }
        Returns: string
      }
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      can_create_branch: { Args: { _tenant_id: string }; Returns: boolean }
      can_view_repair: {
        Args: { _order_id: string; _uid: string }
        Returns: boolean
      }
      cancel_repair: {
        Args: { _order_id: string; _reason: string }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_stock_transfer: {
        Args: { _reason?: string; _transfer_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          status: string
          tenant_id: string
          to_branch_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_repair_status: {
        Args: { _note?: string; _order_id: string; _status: string }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_stale_tenants: { Args: never; Returns: undefined }
      consume_repair_part: {
        Args: { _part_id: string }
        Returns: {
          consumed: boolean
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          tenant_id: string
          unit_cost_usd: number
          unit_price_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "repair_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_repair_order: {
        Args: {
          _branch_id: string
          _customer_id: string
          _data: Json
          _technician_id?: string
          _unlock_code?: string
        }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_stock_transfer: {
        Args: {
          _from_branch: string
          _note?: string
          _product_id: string
          _quantity: number
          _to_branch: string
        }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          status: string
          tenant_id: string
          to_branch_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_repair_quote: {
        Args: { _approved: boolean; _note?: string; _order_id: string }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      delete_repair_order: {
        Args: { _order_id: string }
        Returns: boolean
      }
      deliver_repair: {
        Args: { _exception_reason?: string; _order_id: string }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      receive_purchase_order: {
        Args: { _po_id: string }
        Returns: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          paid_usd: number
          po_number: number
          received_at: string | null
          status: string
          supplier_id: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      receive_stock_transfer: {
        Args: { _transfer_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          from_branch_id: string
          id: string
          note: string | null
          product_id: string
          quantity: number
          received_at: string | null
          received_by: string | null
          status: string
          tenant_id: string
          to_branch_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_inventory_movement: {
        Args: {
          _branch_id?: string
          _movement_type: string
          _product_id: string
          _quantity: number
          _reference?: string
          _unit_cost?: number
        }
        Returns: {
          avg_cost_usd: number
          balance_qty: number
          branch_id: string
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
      record_layaway_payment: {
        Args: {
          _amount: number
          _layaway_id: string
          _method?: string
          _note?: string
        }
        Returns: {
          branch_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          expires_at: string | null
          id: string
          paid_usd: number
          status: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "layaways"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_payable_payment: {
        Args: {
          _amount: number
          _method?: string
          _note?: string
          _po_id: string
        }
        Returns: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          paid_usd: number
          po_number: number
          received_at: string | null
          status: string
          supplier_id: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_receivable_payment: {
        Args: {
          _amount: number
          _method?: string
          _note?: string
          _receivable_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          due_date: string | null
          id: string
          paid_usd: number
          sale_id: string | null
          status: string
          tenant_id: string
          total_usd: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "receivables"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_repair_payment: {
        Args: {
          _amount: number
          _currency: string
          _kind?: string
          _method: string
          _order_id: string
        }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_trial_request: {
        Args: { _reason: string; _request_id: string }
        Returns: undefined
      }
      request_trial_for_current_user: {
        Args: {
          _city: string
          _country: string
          _ip_address: string
          _latitude: number
          _location_accuracy: number
          _longitude: number
          _notes: string
          _phone: string
          _tenant_name: string
          _user_agent: string
        }
        Returns: string
      }
      save_repair_quote: {
        Args: {
          _labor: number
          _note?: string
          _order_id: string
          _parts: Json
          _skip_approval?: boolean
        }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_repair_part_cost: {
        Args: { _part_id: string; _unit_cost: number }
        Returns: {
          consumed: boolean
          consumed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          tenant_id: string
          unit_cost_usd: number
          unit_price_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "repair_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shares_tenant: { Args: { _a: string; _b: string }; Returns: boolean }
      submit_payment_and_mark_pending: {
        Args: {
          _amount: number
          _bank_account_id: string
          _currency: string
          _plan_id: string
          _receipt_path: string
          _reference: string
          _tenant_id: string
        }
        Returns: string
      }
      submit_trial_request: {
        Args: {
          _business_name: string
          _city: string
          _country: string
          _email: string
          _full_name: string
          _ip_address: string
          _latitude: number
          _location_accuracy: number
          _longitude: number
          _notes: string
          _phone: string
          _user_agent: string
        }
        Returns: string
      }
      transfer_stock: {
        Args: {
          _from_branch: string
          _note?: string
          _product_id: string
          _quantity: number
          _to_branch: string
        }
        Returns: undefined
      }
      update_repair_order: {
        Args: { _data: Json; _order_id: string }
        Returns: {
          accessories: string | null
          branch_id: string
          brand: string
          cancel_reason: string | null
          cancelled_at: string | null
          color: string | null
          created_at: string
          created_by: string
          customer_id: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_exception_reason: string | null
          diagnosis: string | null
          estimated_delivery: string | null
          id: string
          imei: string | null
          labor_usd: number
          model: string
          observations: string | null
          order_number: number
          paid_usd: number
          parts_cost_usd: number
          parts_usd: number
          photo_paths: string[]
          physical_condition: string | null
          quote_status: string
          reported_issue: string
          status: string
          technician_id: string | null
          tenant_id: string
          total_usd: number
          updated_at: string
          work_to_do: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_sale: {
        Args: { _reason?: string; _sale_id: string }
        Returns: {
          branch_id: string
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
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "superadmin" | "user"
      subscription_status:
        | "trial"
        | "active"
        | "suspended"
        | "cancelled"
        | "pending_payment"
        | "pending_verification"
        | "pending_trial_approval"
      tenant_role: "owner" | "admin" | "cashier" | "accountant" | "technician"
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
      app_role: ["superadmin", "user"],
      subscription_status: [
        "trial",
        "active",
        "suspended",
        "cancelled",
        "pending_payment",
        "pending_verification",
        "pending_trial_approval",
      ],
      tenant_role: ["owner", "admin", "cashier", "accountant", "technician"],
    },
  },
} as const
