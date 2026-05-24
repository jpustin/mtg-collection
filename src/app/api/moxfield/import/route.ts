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

const HEADER_LINES = /^(sideboard|mainboard|main|deck|creatures|instants|sorceries|enchantments|artifacts|planeswalkers|lands|tokens|maybeboard|commanders|companions):$/i;

function cleanCardName(raw: string): string {
  return raw
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/\s*\[.*?\]\s*/g, "")
    .replace(/\s*\{.*?\}\s*/g, "")
    .replace(/\s*#\d+\s*$/, "")
    .replace(/^\s*SB:\s*/i, "")
    .trim();
}

function hasPrice(card: ScryfallResult): boolean {
  return !!(card.prices?.usd || card.prices?.usd_foil || card.prices?.tix);
}

async function findCard(rawName: string): Promise<ScryfallResult | null> {
  const name = cleanCardName(rawName);
  if (!name) return null;

  const namedUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(namedUrl, {
      headers: { "User-Agent": "MTGCollection/1.0" },
    });
    if (res.ok) {
      const card = (await res.json()) as ScryfallResult;
      if (hasPrice(card)) return card;
    }
  } catch {}

  const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&order=usd&dir=desc`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "MTGCollection/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const withPrice = data.data.find(hasPrice);
        if (withPrice) return withPrice as ScryfallResult;
        return data.data[0] as ScryfallResult;
      }
    }
  } catch {}

  return null;
}

interface ParsedLine {
  quantity: number;
  cardName: string;
}

function parseDeckList(text: string): ParsedLine[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const cards: ParsedLine[] = [];

  for (const line of lines) {
    if (HEADER_LINES.test(line)) continue;
    const cleaned = line.replace(/^SB:\s*/i, "");
    const match = cleaned.match(/^(\d+)\s+(.+)$/);
    if (match) {
      cards.push({ quantity: parseInt(match[1]), cardName: match[2].trim() });
    } else {
      cards.push({ quantity: 1, cardName: cleaned });
    }
  }

  return cards;
}

export async function POST(request: NextRequest) {
  try {
    const { collectionId, deckText } = await request.json();

    if (!collectionId || !deckText) {
      return Response.json({ error: "collectionId and deckText are required" }, { status: 400 });
    }

    const parsed = parseDeckList(deckText);

    if (parsed.length === 0) {
      return Response.json({ error: "No cards found in deck list" }, { status: 400 });
    }

    let imported = 0;
    let errors: string[] = [];

    for (const { cardName, quantity } of parsed) {
      await new Promise((r) => setTimeout(r, 150));

      const scryfall = await findCard(cardName);
      if (!scryfall) {
        errors.push(`${cardName}: not found on Scryfall`);
        continue;
      }

      const imageUrl = scryfall.image_uris?.small || scryfall.card_faces?.[0]?.image_uris?.small || null;
      const game = scryfall.digital ? "mtgo" : "paper";

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
          game,
              priceUsd: scryfall.prices?.usd ? parseFloat(scryfall.prices.usd) : null,
              priceUsdFoil: scryfall.prices?.usd_foil ? parseFloat(scryfall.prices.usd_foil) : null,
              priceEur: scryfall.prices?.eur ? parseFloat(scryfall.prices.eur) : null,
              priceEurFoil: scryfall.prices?.eur_foil ? parseFloat(scryfall.prices.eur_foil) : null,
              priceTix: scryfall.prices?.tix ? parseFloat(scryfall.prices.tix) : null,
        },
      });
      imported++;
    }

    return Response.json({ imported, total: parsed.length, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error("Import error:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
