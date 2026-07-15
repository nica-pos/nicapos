
-- Add superadmin bypass to tenant-scoped data tables so superadmins can operate on any tenant.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cash_sessions','cash_movements','products','sales','sale_items','sale_payments',
    'inventory_movements','customers','suppliers','purchase_orders','purchase_order_items',
    'payable_payments','receivables','receivable_payments','layaways','layaway_items','layaway_payments',
    'stock_audits','stock_audit_items','promotions','combo_components','categories','brands','product_models',
    'fiscal_settings','exchange_rates','audit_logs'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Superadmin full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Superadmin full access" ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()))',
      t
    );
  END LOOP;
END $$;
