import { describe, expect, it } from "vitest";
import { formatRepairMoney, repairDisplayAmount, repairCurrency, repairRate } from "./repair-currency";

const order = { currency: "NIO", exchange_rate: 37.2, total_usd: 86.02, paid_usd: 53.76, total_amount: 3200, paid_amount: 2000 };
describe("saved repair currency", () => {
  it("keeps C$3,200 despite rounded base dollars", () => {
    expect(repairDisplayAmount(order, 86.02)).toBe(3200);
    expect(formatRepairMoney(order, 86.02)).toBe("C$ 3,200.00");
  });
  it("keeps the original advance and exact remaining balance", () => {
    expect(repairDisplayAmount(order, 53.76)).toBe(2000);
    expect(repairDisplayAmount(order, 32.26)).toBe(1200);
  });
  it("uses the saved rate instead of a newer rate", () => {
    expect(repairRate(order, 40)).toBe(37.2);
    expect(repairDisplayAmount(order, 10)).toBe(372);
  });
  it("leaves dollar orders in dollars", () => {
    expect(repairCurrency({ currency: "USD" })).toBe("USD");
    expect(formatRepairMoney({ currency: "USD" }, 3200)).toBe("$3,200.00");
  });
});