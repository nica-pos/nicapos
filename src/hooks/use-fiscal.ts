import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";

export type FiscalSettings = Database["public"]["Tables"]["fiscal_settings"]["Row"];
export type ExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];

export function useFiscalSettings() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["fiscal-settings", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<FiscalSettings | null> => {
      const { data, error } = await supabase
        .from("fiscal_settings")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useExchangeRates() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["exchange-rates", tenant?.id],
    enabled: !!tenant,
    queryFn: async (): Promise<ExchangeRate[]> => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Latest exchange rate (NIO per 1 USD), or null if none set. */
export function useLatestRate(): number | null {
  const { data } = useExchangeRates();
  return data && data.length > 0 ? Number(data[0].rate) : null;
}

// ---- Currency helpers ----
export function usdToNio(usd: number, rate: number): number {
  return usd * rate;
}
export function nioToUsd(nio: number, rate: number): number {
  return rate > 0 ? nio / rate : 0;
}

export function formatNIO(value: number): string {
  return `C$ ${value.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function formatUSD(value: number): string {
  return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface TaxBreakdown {
  subtotal: number;
  ivaAmount: number;
  irAmount: number;
  total: number;
}

/**
 * Compute a tax breakdown in the base currency (USD).
 * subtotal = taxable + exempt base. IVA applies to taxable only.
 * IR is a withholding subtracted from the total when enabled.
 */
export function computeTaxes(
  taxableBase: number,
  exemptBase: number,
  opts: { ivaRate: number; ivaEnabled: boolean; irRate: number; irEnabled: boolean },
): TaxBreakdown {
  const subtotal = taxableBase + exemptBase;
  const ivaAmount = opts.ivaEnabled ? taxableBase * opts.ivaRate : 0;
  const irAmount = opts.irEnabled ? subtotal * opts.irRate : 0;
  const total = subtotal + ivaAmount - irAmount;
  return { subtotal, ivaAmount, irAmount, total };
}
