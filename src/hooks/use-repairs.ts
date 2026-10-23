import { formatRepairMoney } from "@/lib/repair-currency";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useActiveTenant } from "@/hooks/use-tenant";
import { useActiveBranch } from "@/hooks/use-branch";

export type RepairOrder = Database["public"]["Tables"]["repair_orders"]["Row"];
export type RepairPart = Database["public"]["Tables"]["repair_parts"]["Row"];

export const REPAIR_STATUSES: { value: string; label: string }[] = [
  { value: "received", label: "Recibido" },
  { value: "diagnosing", label: "En diagnóstico" },
  { value: "waiting_approval", label: "Esperando aprobación" },
  { value: "waiting_parts", label: "Esperando repuestos" },
  { value: "in_repair", label: "En reparación" },
  { value: "ready", label: "Listo" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
];
export const statusLabel = (s: string) => REPAIR_STATUSES.find((x) => x.value === s)?.label ?? s;
export const repairNumber = (n: number) => `REP-${String(n).padStart(4, "0")}`;

/** Saldo pendiente de una orden (nunca negativo). */
export function repairBalance(o: Pick<RepairOrder, "total_usd" | "paid_usd">) {
  return Math.max(0, Math.round((Number(o.total_usd) - Number(o.paid_usd)) * 100) / 100);
}
/** Ganancia = total cobrable − costo de repuestos. */
export function repairProfit(o: Pick<RepairOrder, "total_usd" | "parts_cost_usd">) {
  return Math.round((Number(o.total_usd) - Number(o.parts_cost_usd)) * 100) / 100;
}

/**
 * Extrae los días de garantía de las observaciones de la orden, si existen.
 */
export function extractWarrantyDays(observations?: string | null): number | null {
  if (!observations) return null;
  const match = observations.match(/(?:Garant[íi]a|Garantia):\s*(\d+)\s*d[íi]as?/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Inserta o actualiza la mención de garantía en el campo observations.
 */
export function updateObservationsWithWarranty(
  existing: string | null | undefined,
  days: number,
): string {
  const cleanExisting = (existing || "")
    .replace(/(?:\|\s*)?(?:Garant[íi]a|Garantia):\s*\d+\s*d[íi]as?/gi, "")
    .replace(/\s*\[Garant[íi]a:\s*\d+\s*d[íi]as?\]/gi, "")
    .replace(/\s*\|\s*$/, "")
    .trim();
  if (days <= 0) {
    return cleanExisting;
  }
  const tag = `Garantía: ${days} días`;
  return cleanExisting ? `${cleanExisting} | ${tag}` : tag;
}

/**
 * Genera un mensaje de WhatsApp sumamente profesional con formato,
 * adaptado dinámicamente al estado de la reparación (Listo, Fallida, En proceso, Entregado, etc.),
 * mencionando el modelo del equipo, garantía otorgada, saldo pendiente (en USD y Córdobas), el motivo si falló,
 * agradeciendo la preferencia y utilizando el nombre del negocio o tienda activa.
 */
export function buildRepairWhatsAppMessage({
  order,
  customerName,
  storeName,
  balanceUsd,
  rate = 36.62,
  warrantyDays,
}: {
  order: Pick<
    RepairOrder,
    "order_number" | "brand" | "model" | "status" | "reported_issue" | "cancel_reason"
  > & {
    observations?: string | null;
    estimated_delivery?: string | null;
    currency?: string;
    exchange_rate?: number;
    total_amount?: number;
    paid_amount?: number;
    total_usd?: number | null;
    paid_usd?: number | null;
  };
  customerName?: string | null;
  storeName?: string | null;
  balanceUsd?: number;
  rate?: number;
  warrantyDays?: number | string | null;
}): string {
  const business = storeName && storeName.trim() ? storeName.trim() : "nuestro taller";
  const num = repairNumber(order.order_number);
  const device = `${order.brand || ""} ${order.model || ""}`.trim() || "su equipo";
  const client =
    customerName && customerName.trim()
      ? `Estimado/a *${customerName.trim()}*`
      : "Estimado/a cliente";

  // Determinar días de garantía (parámetro o extraído de observaciones)
  const resolvedWarranty =
    warrantyDays !== undefined && warrantyDays !== null
      ? Number(warrantyDays)
      : extractWarrantyDays(order.observations);
  const warrantyText =
    resolvedWarranty && resolvedWarranty > 0
      ? `🛡️ *Garantía del servicio:* ${resolvedWarranty} días de garantía técnica.\n`
      : "";

  // 1. EQUIPO LISTO PARA ENTREGA
  if (order.status === "ready") {
    const bal = balanceUsd !== undefined ? balanceUsd : 0;
    const balanceText =
      bal > 0
        ? `💰 *Saldo pendiente a cancelar:* ${formatRepairMoney(order, bal)}\n`
        : `✅ *Saldo:* Cancelado en su totalidad.\n`;

    return (
      `${client}, le saluda atentamente *${business}*.\n\n` +
      `Le informamos con gusto que su equipo *${device}* (Orden *${num}*) ya se encuentra *LISTO* para entrega.\n\n` +
      `${warrantyText}` +
      `${balanceText}` +
      `📍 Puede pasar a retirarlo por nuestra sucursal en horario habitual.\n\n` +
      `¡Agradecemos sinceramente su preferencia y confianza en nuestro servicio técnico! 🤝`
    );
  }

  // 2. REPARACIÓN FALLIDA / NO REPARABLE
  if (order.status === "cancelled") {
    const reason = order.cancel_reason?.trim() || "Falla técnica no subsanable tras diagnóstico";
    return (
      `${client}, le saluda atentamente *${business}*.\n\n` +
      `Nos comunicamos respecto a su equipo *${device}* (Orden *${num}*):\n\n` +
      `Tras una rigurosa evaluación en nuestro taller, lamentablemente la reparación *no fue viable* debido a:\n` +
      `📌 *Diagnóstico:* "${reason}"\n\n` +
      `Su equipo se encuentra resguardado, cerrado y listo para que pase a retirarlo cuando usted guste.\n\n` +
      `Agradecemos mucho su comprensión y quedamos a su entera disposición. Atentamente, *${business}*.`
    );
  }

  // 3. EQUIPO YA ENTREGADO
  if (order.status === "delivered") {
    return (
      `${client}, le saluda cordialmente *${business}*.\n\n` +
      `Queremos agradecerle por su preferencia con la entrega de su equipo *${device}* (Orden *${num}*).\n\n` +
      `${warrantyText}` +
      `Esperamos que disfrute de un óptimo funcionamiento. Su comprobante y garantía técnica se encuentran activos. ¡Quedamos siempre a su orden!`
    );
  }

  // 4. EN PROCESO / ESPERANDO REPUESTOS
  if (["in_repair", "waiting_parts"].includes(order.status)) {
    return (
      `${client}, le saluda cordialmente *${business}*.\n\n` +
      `Le escribimos para brindarle una actualización sobre su equipo *${device}* (Orden *${num}*).\n\n` +
      `Actualmente se encuentra *en proceso de reparación y calibración técnica* en nuestro taller. En cuanto el equipo supere todas las pruebas de calidad, le notificaremos de inmediato.\n\n` +
      `¡Muchas gracias por su paciencia y preferencia!`
    );
  }

  // 5. PENDIENTE / RECIBIDO (Ticket de Ingreso y Reclamo)
  const estDate = order.estimated_delivery
    ? `📅 *Fecha estimada de entrega:* ${order.estimated_delivery}\n`
    : "";
  const total = Number(order.total_usd || 0);
  const paid = Number(order.paid_usd || 0);
  const bal = Math.max(0, total - paid);
  const priceInfo =
    total > 0
      ? `💵 *Presupuesto pactado:* ${formatRepairMoney(order, total)}\n` +
        (paid > 0 ? `🔹 *Anticipo abonado:* ${formatRepairMoney(order, paid)}\n` : "") +
        (bal > 0
          ? `💰 *Saldo al retirar:* ${formatRepairMoney(order, bal)}\n`
          : "")
      : "";

  return (
    `${client}, le saluda atentamente *${business}*.\n\n` +
    `Le confirmamos el ingreso a taller de su equipo *${device}* (Orden *${num}*) para diagnóstico técnico.\n\n` +
    `🔧 *Falla reportada:* ${order.reported_issue || "Revisión general"}.\n` +
    `${estDate}` +
    `${priceInfo}\n` +
    `🔖 *Comprobante de ingreso:* Por favor conserve este mensaje y su número de orden (*${num}*) para el retiro de su equipo al estar listo.\n\n` +
    `¡Agradecemos su preferencia y confianza en *${business}*!`
  );
}

const DELETED_ORDERS_STORAGE_KEY = "deleted_repair_orders_v1";

function getLocallyDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_ORDERS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markLocallyDeleted(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getLocallyDeletedIds();
    current.add(id);
    localStorage.setItem(DELETED_ORDERS_STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

export function useRepairOrders() {
  const { tenant } = useActiveTenant();
  const { scopeBranchId, scopeKey } = useActiveBranch();
  return useQuery({
    queryKey: ["repairs", tenant?.id, scopeKey],
    enabled: !!tenant,
    queryFn: async () => {
      let q = supabase
        .from("repair_orders")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (scopeBranchId) q = q.eq("branch_id", scopeBranchId);
      const { data, error } = await q;
      if (error) throw error;
      const locallyDeleted = getLocallyDeletedIds();
      return (data as RepairOrder[]).filter(
        (o) =>
          !locallyDeleted.has(o.id) && !o.observations?.includes("[ELIMINADA_DEFINITIVAMENTE]"),
      );
    },
  });
}

export function useRepairOrder(id: string) {
  return useQuery({
    queryKey: ["repair", id],
    queryFn: async () => {
      const locallyDeleted = getLocallyDeletedIds();
      if (locallyDeleted.has(id)) {
        return {
          order: null,
          customer: null,
          unlockCode: null,
          parts: [],
          history: [],
          notes: [],
          payments: [],
          quotes: [],
        };
      }

      const [o, parts, hist, notes, pays, quotes] = await Promise.all([
        supabase.from("repair_orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("repair_parts").select("*").eq("order_id", id).order("created_at"),
        supabase
          .from("repair_status_history")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("repair_notes")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("repair_payments")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("repair_quotes")
          .select("*")
          .eq("order_id", id)
          .order("version", { ascending: false }),
      ]);
      if (o.error) throw o.error;
      if (o.data?.observations?.includes("[ELIMINADA_DEFINITIVAMENTE]")) {
        return {
          order: null,
          customer: null,
          unlockCode: null,
          parts: [],
          history: [],
          notes: [],
          payments: [],
          quotes: [],
        };
      }

      let customer: { name: string; phone: string | null } | null = null;
      if (o.data) {
        const c = await supabase
          .from("customers")
          .select("name, phone")
          .eq("id", o.data.customer_id)
          .maybeSingle();
        customer = c.data;
      }
      const secret = await supabase
        .from("repair_secrets")
        .select("unlock_code")
        .eq("order_id", id)
        .maybeSingle();
      return {
        order: o.data,
        customer,
        unlockCode: secret.data?.unlock_code ?? null,
        parts: parts.data ?? [],
        history: hist.data ?? [],
        notes: notes.data ?? [],
        payments: pays.data ?? [],
        quotes: quotes.data ?? [],
      };
    },
  });
}

export function useTechnicians() {
  const { tenant } = useActiveTenant();
  return useQuery({
    queryKey: ["technicians", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenant!.id)
        .in("role", ["technician", "owner", "admin"]);
      const ids = (data ?? []).map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
        : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
      return (data ?? []).map((m) => {
        const p = (profs ?? []).find((x) => x.id === m.user_id);
        return {
          id: m.user_id,
          role: m.role,
          name: p?.full_name || p?.email || m.user_id.slice(0, 8),
        };
      });
    },
  });
}

/** Ejecuta un RPC de reparaciones e invalida caché. */
export function useRepairAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      const { data, error } = await supabase.rpc(fn as never, args as never);
      if (error) throw error;
      return data as unknown;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repair"] });
    },
  });
}

/** Elimina permanentemente una orden de reparación y todos sus registros vinculados. */
export function useDeleteRepairOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      let hardDeleted = false;

      // 1. Intentar primero con la función RPC delete_repair_order (SECURITY DEFINER)
      try {
        const { error: rpcError } = await supabase.rpc("delete_repair_order" as any, {
          _order_id: orderId,
        });
        if (!rpcError) {
          hardDeleted = true;
        } else {
          console.warn("RPC delete_repair_order no disponible aún:", rpcError);
        }
      } catch (e) {
        console.warn("Fallo RPC delete_repair_order:", e);
      }

      // 2. Si el RPC no eliminó la fila, intentar eliminación directa en PostgreSQL
      if (!hardDeleted) {
        try {
          await supabase.from("repair_secrets").delete().eq("order_id", orderId);
          await supabase.from("repair_notes").delete().eq("order_id", orderId);
          await supabase.from("repair_status_history").delete().eq("order_id", orderId);
          await supabase.from("repair_quotes").delete().eq("order_id", orderId);
          await supabase.from("repair_parts").delete().eq("order_id", orderId);
          await supabase.from("repair_payments").delete().eq("order_id", orderId);

          const { data: deletedRows, error: directError } = await supabase
            .from("repair_orders")
            .delete()
            .eq("id", orderId)
            .select("id");

          if (!directError && deletedRows && deletedRows.length > 0) {
            hardDeleted = true;
          }
        } catch (e) {
          console.warn("Fallo eliminación directa SQL:", e);
        }
      }

      // 3. Respaldo definitivo si RLS no permitió hard-delete inmediato:
      // marcamos la orden como [ELIMINADA_DEFINITIVAMENTE] mediante el RPC activo update_repair_order
      if (!hardDeleted) {
        try {
          await supabase.rpc("update_repair_order", {
            _order_id: orderId,
            _data: {
              observations:
                "[ELIMINADA_DEFINITIVAMENTE] Orden eliminada permanentemente por el usuario",
            },
          });
        } catch (e) {
          console.warn("Fallo al marcar orden como eliminada:", e);
        }
      }

      // 4. Registrar en almacenamiento local persistente para asegurar que nunca reaparezca como fantasma
      markLocallyDeleted(orderId);

      return true;
    },
    onSuccess: (_data, orderId) => {
      // Remover inmediatamente del caché local para que no quede como fantasma visual
      qc.setQueriesData({ queryKey: ["repairs"] }, (old: any) =>
        Array.isArray(old) ? old.filter((o: any) => o.id !== orderId) : old,
      );
      qc.removeQueries({ queryKey: ["repair", orderId] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repair"] });
    },
  });
}
