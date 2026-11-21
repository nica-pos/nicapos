import { describe, expect, it } from "vitest";
import { formatProductPrice, productPriceAmount, productPriceFields } from "./product-currency";

describe("original product currency", () => {
  it("keeps a product entered in córdobas in córdobas after saving", () => {
    const saved = productPriceFields(3200, "NIO", 37.2);
    expect(saved.price_currency).toBe("NIO");
    expect(saved.price_amount).toBe(3200);
    expect(formatProductPrice(saved)).toBe("C$ 3,200.00");
  });
  it("does not change the listed or editable price when the exchange rate changes", () => {
    const saved = productPriceFields(3200, "NIO", 37.2);
    expect(productPriceAmount(saved, 40)).toBe(3200);
    expect(saved.price_exchange_rate).toBe(37.2);
    expect(saved.price_usd).toBe(86.0215);
  });
  it("preserves products entered in dollars", () => {
    const saved = productPriceFields(25, "USD", 37.2);
    expect(saved.price_usd).toBe(25);
    expect(formatProductPrice(saved, 40)).toBe("$ 25.00");
  });
  it("requires an exchange rate when storing a córdoba price", () => {
    expect(() => productPriceFields(3200, "NIO", 0)).toThrow();
  });
});