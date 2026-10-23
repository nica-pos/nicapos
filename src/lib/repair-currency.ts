export type RepairCurrencyData = {
  currency?: string;
  exchange_rate?: number;
  total_usd?: number | null;
  paid_usd?: number | null;
  total_amount?: number;
  paid_amount?: number;
};

export function repairCurrency(o: RepairCurrencyData): "NIO" | "USD" {
  return o.currency === "NIO" ? "NIO" : "USD";
}
export function repairRate(o: RepairCurrencyData, fallback = 36.62) {
  return Number(o.exchange_rate) > 0 ? Number(o.exchange_rate) : fallback;
}
export function repairDisplayAmount(o: RepairCurrencyData, usd: number) {
  if (repairCurrency(o) === "USD") return usd;
  if (usd === Number(o.total_usd) && o.total_amount !== undefined) return Number(o.total_amount);
  if (usd === Number(o.paid_usd) && o.paid_amount !== undefined) return Number(o.paid_amount);
  const balance = Math.max(0, Math.round((Number(o.total_usd) - Number(o.paid_usd)) * 100) / 100);
  if (usd === balance && o.total_amount !== undefined && o.paid_amount !== undefined) {
    return Math.max(0, Math.round((o.total_amount - o.paid_amount) * 100) / 100);
  }
  return Math.round(usd * repairRate(o) * 100) / 100;
}
export function formatRepairMoney(o: RepairCurrencyData, usd: number) {
  const amount = repairDisplayAmount(o, usd);
  return `${repairCurrency(o) === "NIO" ? "C$ " : "$"}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}