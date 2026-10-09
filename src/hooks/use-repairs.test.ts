import { describe, expect, it } from "vitest";
import { repairBalance, repairProfit } from "./use-repairs";

describe("reparaciones", () => {
  it("saldo pendiente = total - pagado", () => {
    expect(repairBalance({ total_usd: 50, paid_usd: 20 })).toBe(30);
  });
  it("saldo nunca negativo", () => {
    expect(repairBalance({ total_usd: 50, paid_usd: 60 })).toBe(0);
  });
  it("ganancia = total - costo de repuestos", () => {
    expect(repairProfit({ total_usd: 80, parts_cost_usd: 25 })).toBe(55);
  });
});
