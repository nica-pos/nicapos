
-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_tenant() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, tenant_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_tenant(uuid, uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_layaway_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_payable_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_receivable_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text) FROM PUBLIC, anon;

-- Ensure authenticated retains access to functions used by app + RLS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, tenant_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_layaway_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payable_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_receivable_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid, text, numeric, numeric, text) TO authenticated;
