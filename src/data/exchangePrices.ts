import type { ExchangePrice } from "../types/index.js";
import { fetchExchangeAll } from "./fio.js";
import { getAllCxStations } from "./cache.js";
import { getCxDistances } from "./cxDistances.js";

const prices = new Map<string, ExchangePrice>();
const currencyByExchange = new Map<string, string>();

export async function loadExchangePrices(): Promise<void> {
  // Build currency lookup from CX station data
  for (const cx of getAllCxStations()) {
    currencyByExchange.set(cx.ComexCode, cx.CurrencyCode);
  }

  const data = await fetchExchangeAll();
  prices.clear();

  for (const item of data) {
    const key = `${item.MaterialTicker}.${item.ExchangeCode}`;
    prices.set(key, {
      ticker: item.MaterialTicker,
      exchangeCode: item.ExchangeCode,
      currency: currencyByExchange.get(item.ExchangeCode) ?? "",
      ask: item.Ask,
      bid: item.Bid,
      supply: item.Supply,
      demand: item.Demand,
      priceAverage: item.PriceAverage,
    });
  }

  console.log(`Loaded ${prices.size} exchange prices`);
}

export function getPriceAtExchange(ticker: string, exchangeCode: string): ExchangePrice | null {
  return prices.get(`${ticker}.${exchangeCode}`) ?? null;
}

/** Get price at the nearest CX that trades this material */
export function getNearestCxPrice(ticker: string, systemId: string): ExchangePrice | null {
  const distances = getCxDistances(systemId);
  for (const entry of distances) {
    if (entry.jumps === -1) continue;
    const price = prices.get(`${ticker}.${entry.code}`);
    if (price && (price.ask !== null || price.bid !== null)) return price;
  }
  return null;
}
