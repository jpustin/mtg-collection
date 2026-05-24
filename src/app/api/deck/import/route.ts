import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface ScryfallResult {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  image_uris?: { small: string };
  card_faces?: { image_uris?: { small: string } }[];
  prices: { usd: string | null; usd_foil: string | null; eur: string | null; eur_foil: string | null; tix: string | null };
  digital: boolean;
}

function hasPrice(card: ScryfallResult): boolean {
  return !!(card.prices?.usd || card.prices?.usd_foil || card.prices?.tix);
}

function cleanCardName(raw: string): string {
  return raw.replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, "").trim();
}

async function searchCard(rawName: string): Promise<ScryfallResult | null> {
  const name = cleanCardName(rawName);
  if (!name) return null;

  const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&order=released&dir=asc`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "MTGCollection/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const cards = data.data as ScryfallResult[];
        const paperWithPrice = cards.find((c) => !c.digital && hasPrice(c));
        if (paperWithPrice) return paperWithPrice;
        const paper = cards.find((c) => !c.digital);
        if (paper) return paper;
        return cards[0] as ScryfallResult;
      }
    }
  } catch {}

  return null;
}

function parseArchidektDeck(data: any): { quantity: number; cardName: string }[] {
  const cards: { quantity: number; cardName: string }[] = [];
  if (!data.cards) return cards;

  for (const entry of data.cards) {
    const name = entry.card?.oracleCard?.name;
    if (!name) continue;
    const categories = entry.categories as string[] | null;
    if (categories?.includes("Commander") || categories?.includes("Companion")) continue;
    cards.push({ quantity: entry.quantity || 1, cardName: name });
  }

  return cards;
}

async function createItem(collectionId: string, cardName: string, quantity: number, scryfall: ScryfallResult) {
  const imageUrl = scryfall.image_uris?.small || scryfall.card_faces?.[0]?.image_uris?.small || null;

  await prisma.collectionItem.create({
    data: {
      collectionId,
      scryfallId: scryfall.id,
      oracleId: scryfall.oracle_id,
      cardName: scryfall.name,
      setCode: scryfall.set,
      setName: scryfall.set_name,
      imageUrl,
      condition: "NM",
      isFoil: false,
      quantity,
      game: "paper",
      priceUsd: scryfall.prices?.usd ? parseFloat(scryfall.prices.usd) : null,
      priceUsdFoil: scryfall.prices?.usd_foil ? parseFloat(scryfall.prices.usd_foil) : null,
      priceEur: scryfall.prices?.eur ? parseFloat(scryfall.prices.eur) : null,
      priceEurFoil: scryfall.prices?.eur_foil ? parseFloat(scryfall.prices.eur_foil) : null,
      priceTix: scryfall.prices?.tix ? parseFloat(scryfall.prices.tix) : null,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { collectionId, url } = await request.json();

    if (!collectionId || !url) {
      return Response.json({ error: "collectionId and url are required" }, { status: 400 });
    }

    let parsed: { quantity: number; cardName: string }[] = [];

    const archidektMatch = url.match(/archidekt\.com\/decks\/(\d+)/i);
    const moxfieldMatch = url.match(/moxfield\.com\/decks\/([a-zA-Z0-9]+)/i);

    if (archidektMatch) {
      const deckId = archidektMatch[1];
      const res = await fetch(`https://archidekt.com/api/decks/${deckId}/`, {
        headers: { "User-Agent": "MTGCollection/1.0", "Accept": "application/json" },
      });
      if (!res.ok) {
        return Response.json({ error: "Failed to fetch deck from Archidekt" }, { status: 502 });
      }
      const data = await res.json();
      parsed = parseArchidektDeck(data);
    } else if (moxfieldMatch) {
      return Response.json({
        error: "moxfield_blocked",
        message: "Moxfield blocks automated requests. Please export your deck as text from Moxfield and use the paste option instead."
      }, { status: 400 });
    } else {
      return Response.json({ error: "Unsupported deck URL. Only Archidekt and Moxfield URLs are supported." }, { status: 400 });
    }

    if (parsed.length === 0) {
      return Response.json({ error: "No cards found in deck" }, { status: 400 });
    }

    // Deduplicate by name
    const nameToQuantity = new Map<string, number>();
    for (const { cardName, quantity } of parsed) {
      nameToQuantity.set(cardName, (nameToQuantity.get(cardName) || 0) + quantity);
    }
    const uniqueNames = [...nameToQuantity.keys()];

    let imported = 0;
    const errors: string[] = [];

    // Batch resolve via Scryfall collection endpoint
    const identifiers = uniqueNames.map((name) => ({ name }));
    const collRes = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "User-Agent": "MTGCollection/1.0", "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });

    const resolved = new Map<string, ScryfallResult>();
    let notFound: string[] = [];

    if (collRes.ok) {
      const collData = await collRes.json();
      if (collData.data) {
        for (const card of collData.data as ScryfallResult[]) {
          if (!card.digital && hasPrice(card)) {
            resolved.set(card.name.toLowerCase(), card);
          }
        }
        for (const card of collData.data as ScryfallResult[]) {
          const key = card.name.toLowerCase();
          if (!resolved.has(key) && !card.digital) {
            resolved.set(key, card);
          }
        }
        for (const card of collData.data as ScryfallResult[]) {
          const key = card.name.toLowerCase();
          if (!resolved.has(key)) {
            resolved.set(key, card);
          }
        }
      }
      if (collData.not_found) {
        notFound = collData.not_found.map((n: any) => typeof n === "string" ? n : n.name).filter(Boolean);
      }
    } else {
      notFound = [...uniqueNames];
    }

    for (const name of uniqueNames) {
      const found = resolved.get(name.toLowerCase());
      if (found) {
        const qty = nameToQuantity.get(name) || 1;
        await createItem(collectionId, name, qty, found);
        imported++;
      } else if (!notFound.includes(name)) {
        notFound.push(name);
      }
    }

    for (const name of notFound) {
      await new Promise((r) => setTimeout(r, 200));
      const scryfall = await searchCard(name);
      if (scryfall) {
        const qty = nameToQuantity.get(name) || 1;
        await createItem(collectionId, name, qty, scryfall);
        imported++;
      } else {
        errors.push(`${name}: not found on Scryfall`);
      }
    }

    return Response.json({ imported, total: parsed.length, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error("Deck import error:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
