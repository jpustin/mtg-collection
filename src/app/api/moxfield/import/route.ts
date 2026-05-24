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

async function upsertItem(collectionId: string, quantity: number, scryfall: ScryfallResult): Promise<"created" | "updated"> {
  const imageUrl = scryfall.image_uris?.small || scryfall.card_faces?.[0]?.image_uris?.small || null;
  const existing = await prisma.collectionItem.findFirst({
    where: { collectionId, oracleId: scryfall.oracle_id, isFoil: false, condition: "NM", game: "paper" },
  });

  if (existing) {
    await prisma.collectionItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
    return "updated";
  }

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
  return "created";
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

    const nameToQuantity = new Map<string, number>();
    const nameToClean = new Map<string, string>();
    for (const { cardName, quantity } of parsed) {
      const clean = cleanCardName(cardName);
      if (!clean) continue;
      nameToQuantity.set(clean, (nameToQuantity.get(clean) || 0) + quantity);
      nameToClean.set(clean, clean);
    }

    const uniqueNames = [...nameToClean.values()];
    let created = 0;
    let updated = 0;
    const updatedNames: string[] = [];
    const errors: string[] = [];

    // Batch resolve via Scryfall collection endpoint (up to 75 per request)
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

    // Create/update items for resolved cards
    for (const name of uniqueNames) {
      const found = resolved.get(name.toLowerCase());
      if (found) {
        const qty = nameToQuantity.get(name) || 1;
        const action = await upsertItem(collectionId, qty, found);
        if (action === "created") created++;
        else { updated++; updatedNames.push(found.name); }
      } else if (!notFound.includes(name)) {
        notFound.push(name);
      }
    }

    // Fall back to individual search for not-found cards
    for (const name of notFound) {
      await new Promise((r) => setTimeout(r, 200));
      const scryfall = await searchCard(name);
      if (scryfall) {
        const qty = nameToQuantity.get(name) || 1;
        const action = await upsertItem(collectionId, qty, scryfall);
        if (action === "created") created++;
        else { updated++; updatedNames.push(scryfall.name); }
      } else {
        errors.push(`${name}: not found on Scryfall`);
      }
    }

    return Response.json({
      created, updated, total: parsed.length,
      updatedNames: updatedNames.length > 0 ? updatedNames : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Import error:", err);
    return Response.json({ error: "Import failed" }, { status: 500 });
  }
}
