export interface PricedItem {
  condition: string;
  game: string;
  isFoil: boolean;
  lang?: string | null;
  priceUsd?: number | null;
  priceUsdFoil?: number | null;
  priceEur?: number | null;
  priceEurFoil?: number | null;
  priceTix?: number | null;
}

export const conditionMult: Record<string, number> = {
  NM: 1,
  LP: 0.85,
  MP: 0.7,
  HP: 0.5,
  DMG: 0.35,
};

export interface PriceResult {
  value: number;
  source: "tcgplayer" | "cardmarket" | "mtgo";
  symbol: string;
  suffix: string;
}

/**
 * Resolves the display price for an item with a layered fallback chain.
 * - MTGO: TIX
 * - Foreign-language cards: prefer CardMarket EUR, then fall back to TCGPlayer USD.
 * - English cards: prefer TCGPlayer USD, then fall back to CardMarket EUR.
 * Within each currency, prefers the matching foil-ness first, then the opposite.
 * Applies the condition multiplier to whichever price is returned.
 */
export function priceDisplay(item: PricedItem): PriceResult | null {
  const mult = conditionMult[item.condition] ?? 1;

  if (item.game === "mtgo") {
    if (item.priceTix == null) return null;
    return { value: item.priceTix * mult, source: "mtgo", symbol: "", suffix: " TIX" };
  }

  const foreign = item.lang && item.lang !== "en";

  const eurPrimary = item.isFoil ? item.priceEurFoil : item.priceEur;
  const eurSecondary = item.isFoil ? item.priceEur : item.priceEurFoil;
  const usdPrimary = item.isFoil ? item.priceUsdFoil : item.priceUsd;
  const usdSecondary = item.isFoil ? item.priceUsd : item.priceUsdFoil;

  const eurAny = eurPrimary ?? eurSecondary;
  const usdAny = usdPrimary ?? usdSecondary;

  if (foreign) {
    if (eurAny != null) return { value: eurAny * mult, source: "cardmarket", symbol: "€", suffix: "" };
    if (usdAny != null) return { value: usdAny * mult, source: "tcgplayer", symbol: "$", suffix: "" };
  } else {
    if (usdAny != null) return { value: usdAny * mult, source: "tcgplayer", symbol: "$", suffix: "" };
    if (eurAny != null) return { value: eurAny * mult, source: "cardmarket", symbol: "€", suffix: "" };
  }
  return null;
}
