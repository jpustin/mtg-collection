/**
 * If all the supplied prices are null, look up other printings of the same
 * card (matched by oracleId + setCode) on Scryfall and return the first set
 * of non-null prices found. This handles foreign-language prints (e.g. Italian
 * Legends) that Scryfall doesn't price directly but the English same-set
 * version does.
 */
export interface ResolvedPrices {
  priceUsd: number | null;
  priceUsdFoil: number | null;
  priceEur: number | null;
  priceEurFoil: number | null;
  priceTix: number | null;
  tcgplayerUrl: string | null;
  cardmarketUrl: string | null;
}

export async function fallbackPrices(opts: {
  oracleId: string | null | undefined;
  setCode: string | null | undefined;
  priceUsd?: number | null;
  priceUsdFoil?: number | null;
  priceEur?: number | null;
  priceEurFoil?: number | null;
  priceTix?: number | null;
  tcgplayerUrl?: string | null;
  cardmarketUrl?: string | null;
}): Promise<ResolvedPrices> {
  const has =
    opts.priceUsd != null ||
    opts.priceUsdFoil != null ||
    opts.priceEur != null ||
    opts.priceEurFoil != null ||
    opts.priceTix != null;
  if (has || !opts.oracleId || !opts.setCode) {
    return {
      priceUsd: opts.priceUsd ?? null,
      priceUsdFoil: opts.priceUsdFoil ?? null,
      priceEur: opts.priceEur ?? null,
      priceEurFoil: opts.priceEurFoil ?? null,
      priceTix: opts.priceTix ?? null,
      tcgplayerUrl: opts.tcgplayerUrl ?? null,
      cardmarketUrl: opts.cardmarketUrl ?? null,
    };
  }
  try {
    const query = `oracleid:${opts.oracleId} set:${opts.setCode} lang:any unique:prints`;
    const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": "MTGCollectionApp/1.0" } });
    if (!res.ok) throw new Error("scryfall");
    const json = await res.json();
    for (const c of (json.data || []) as Array<{
      prices?: Record<string, string | null>;
      purchase_uris?: Record<string, string | null>;
    }>) {
      const p = c.prices || {};
      const usd = p.usd ? parseFloat(p.usd) : null;
      const usdFoil = p.usd_foil ? parseFloat(p.usd_foil) : null;
      const eur = p.eur ? parseFloat(p.eur) : null;
      const eurFoil = p.eur_foil ? parseFloat(p.eur_foil) : null;
      const tix = p.tix ? parseFloat(p.tix) : null;
      if (usd != null || usdFoil != null || eur != null || eurFoil != null || tix != null) {
        return {
          priceUsd: usd,
          priceUsdFoil: usdFoil,
          priceEur: eur,
          priceEurFoil: eurFoil,
          priceTix: tix,
          tcgplayerUrl: c.purchase_uris?.tcgplayer ?? null,
          cardmarketUrl: c.purchase_uris?.cardmarket ?? null,
        };
      }
    }
  } catch {
    // ignore and fall through
  }
  return {
    priceUsd: null,
    priceUsdFoil: null,
    priceEur: null,
    priceEurFoil: null,
    priceTix: null,
    tcgplayerUrl: opts.tcgplayerUrl ?? null,
    cardmarketUrl: opts.cardmarketUrl ?? null,
  };
}

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
