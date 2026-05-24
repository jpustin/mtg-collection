import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const MOXFIELD_API = "https://api.moxfield.com/v2/decks/all";

interface MoxfieldBoard {
  count: number;
  cards: Record<string, { card: { name: string; set: string }; quantity: number }>;
}

interface MoxfieldDeck {
  id: string;
  name: string;
  mainboard: MoxfieldBoard;
  sideboard?: MoxfieldBoard;
  commanders?: MoxfieldBoard;
  companions?: MoxfieldBoard;
}

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

async function findScryfallCard(name: string, setCode: string): Promise<ScryfallResult | null> {
  const exactUrl = `https://api.scryfall.com/cards/${setCode}/${encodeURIComponent(name)}`;
  try {
    const res = await fetchWithRetry(exactUrl, 2);
    if (res.ok) {
      const data = await res.json();
      return data as ScryfallResult;
    }
  } catch {}

  const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}" set:${setCode}`)}&unique=prints`;
  try {
    const res = await fetchWithRetry(searchUrl, 2);
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) return data.data[0] as ScryfallResult;
    }
  } catch {}

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { collectionId, deckUrl } = await request.json();

    if (!collectionId || !deckUrl) {
      return Response.json({ error: "collectionId and deckUrl are required" }, { status: 400 });
    }

    const deckIdMatch = deckUrl.match(/moxfield\.com\/decks\/([a-zA-Z0-9]+)/);
    if (!deckIdMatch) {
      return Response.json({ error: "Invalid Moxfield deck URL" }, { status: 400 });
    }
    const deckId = deckIdMatch[1];

    const moxRes = await fetch(`${MOXFIELD_API}/${deckId}`, {
      headers: {
        "User-Agent": "MTGCollection/1.0",
        "Accept": "application/json",
      },
    });

    if (!moxRes.ok) {
      return Response.json({
        error: `Moxfield returned ${moxRes.status}. This deck may be private or the ID is invalid.`,
      }, { status: 400 });
    }

    const deck: MoxfieldDeck = await moxRes.json();
    const allCards = [
      ...Object.values(deck.mainboard?.cards || {}).map((c) => ({ ...c, board: "mainboard" })),
      ...Object.values(deck.sideboard?.cards || {}).map((c) => ({ ...c, board: "sideboard" })),
      ...Object.values(deck.commanders?.cards || {}).map((c) => ({ ...c, board: "commanders" })),
      ...Object.values(deck.companions?.cards || {}).map((c) => ({ ...c, board: "companions" })),
    ];

    if (allCards.length === 0) {
      return Response.json({ error: "No cards found in this deck" }, { status: 400 });
    }

    let imported = 0;
    let errors: string[] = [];
    const batchSize = 5;

    for (let i = 0; i < allCards.length; i += batchSize) {
      const batch = allCards.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async ({ card, quantity, board }) => {
          const scryfall = await findScryfallCard(card.name, card.set);
          if (!scryfall) {
            errors.push(`${card.name} (${card.set}): not found on Scryfall`);
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
      if (i + batchSize < allCards.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return Response.json({
      imported,
      total: allCards.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Moxfield import error:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
