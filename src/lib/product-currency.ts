export type ProductCurrency = "USD" | "NIO";

type ProductPrice = {
  price_currency?: string;
  price_usd: number;
  price_amount?: number | null;
  price_exchange_rate?: number | null;
};

export function productCurrency(product: ProductPrice): ProductCurrency {
  return product.price_currency === "NIO" ? "NIO" : "USD";
}

export function productPriceAmount(product: ProductPrice, fallbackRate = 0): number {
  if (product.price_amount != null) return Number(product.price_amount);
  if (productCurrency(product) === "USD") return Number(product.price_usd);
  const rate = Number(product.price_exchange_rate) || fallbackRate;
  return Math.round(Number(product.price_usd) * rate * 100) / 100;
}

export function formatProductPrice(product: ProductPrice, fallbackRate = 0): string {
  const prefix = productCurrency(product) === "NIO" ? "C$ " : "$ ";
  return prefix + productPriceAmount(product, fallbackRate).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function productPriceFields(amount: number, currency: ProductCurrency, rate: number) {
  if (currency === "NIO" && rate <= 0) {
    throw new Error("Ingresá el tipo de cambio antes de guardar precios en córdobas");
  }
  return {
    price_currency: currency,
    price_amount: amount,
    price_exchange_rate: currency === "NIO" ? rate : 1,
    price_usd: Number((currency === "NIO" ? amount / rate : amount).toFixed(4)),
  };
}