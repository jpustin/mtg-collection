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
  prices: { usd: string | null; usd_foil: string | null; tix: string | null };
  digital: boolean;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "MTGCollection/1.0" },
    });
    if (res.ok || i === retries - 1) return res;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function findCard(name: string): Promise<ScryfallResult | null> {
  const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&order=released&dir=desc`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "MTGCollection/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) return data.data[0] as ScryfallResult;
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
    const batchSize = 5;

    for (let i = 0; i < parsed.length; i += batchSize) {
      const batch = parsed.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async ({ cardName, quantity }) => {
          const scryfall = await findCard(cardName);
          if (!scryfall) {
            errors.push(`${cardName}: not found on Scryfall`);
            return;
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
              priceTix: scryfall.prices?.tix ? parseFloat(scryfall.prices.tix) : null,
            },
          });
          imported++;
        })
      );
      if (i + batchSize < parsed.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return Response.json({ imported, total: parsed.length, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error("Import error:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
