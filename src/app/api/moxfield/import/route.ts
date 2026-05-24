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

function hasPrice(card: ScryfallResult): boolean {
  return !!(card.prices?.usd || card.prices?.usd_foil || card.prices?.tix);
}

async function searchCard(name: string): Promise<ScryfallResult | null> {
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

async function searchCardWithSet(name: string, setCode: string): Promise<ScryfallResult | null> {
  if (!name || !setCode) return null;

  // First try exact card + set lookup
  const cardUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${name}" set:${setCode}`)}&unique=prints`;
  try {
    const res = await fetch(cardUrl, { headers: { "User-Agent": "MTGCollection/1.0" } });
    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const cards = data.data as ScryfallResult[];
        const withPrice = cards.find((c) => hasPrice(c));
        if (withPrice) return withPrice;
        return cards[0] as ScryfallResult;
      }
    }
  } catch {}

  return null;
}

interface ParsedLine {
  quantity: number;
  cardName: string;
  setCode?: string;
  isFoil?: boolean;
}

function parseDeckList(text: string): ParsedLine[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const cards: ParsedLine[] = [];

  for (const line of lines) {
    if (HEADER_LINES.test(line)) continue;
    const cleaned = line.replace(/^SB:\s*/i, "");

    // Extract (foil) marker
    const isFoil = /\(foil\)/i.test(cleaned);

    // Extract set code from parentheses: (M21), (STA), etc.
    // Matches 2-5 uppercase alphanumeric chars in parens, optionally followed by space + number (collector #)
    const setMatch = cleaned.match(/\(([A-Z0-9]{2,5})\)\s*(?:\d+\s*)?$/i);
    let cardName: string;
    let setCode: string | undefined;

    if (setMatch) {
      setCode = setMatch[1].toLowerCase();
      // Remove the set info and foil marker from the name
      cardName = cleaned
        .replace(/\s*\(foil\)\s*/gi, "")
        .replace(/\s*\([A-Z0-9]{2,5}\)\s*(?:\d+\s*)?$/i, "")
        .trim();
    } else {
      cardName = cleaned
        .replace(/\s*\(foil\)\s*/gi, "")
        .replace(/\s*\(.*?\)\s*/g, "")
        .replace(/\s*\[.*?\]\s*/g, "")
        .replace(/\s*\{.*?\}\s*/g, "")
        .replace(/\s*#\d+\s*$/, "")
        .trim();
    }

    const qtyMatch = cardName.match(/^(\d+)\s+(.+)$/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const name = qtyMatch ? qtyMatch[2].trim() : cardName;

    if (name) {
      cards.push({ quantity, cardName: name, setCode, isFoil });
    }
  }

  return cards;
}

async function upsertItem(collectionId: string, quantity: number, scryfall: ScryfallResult, isFoil = false): Promise<"created" | "updated"> {
  const imageUrl = scryfall.image_uris?.small || scryfall.card_faces?.[0]?.image_uris?.small || null;
  const existing = await prisma.collectionItem.findFirst({
    where: { collectionId, oracleId: scryfall.oracle_id, isFoil, condition: "NM", game: "paper" },
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
      isFoil,
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

    // Separate cards with and without set info
    const withSet = parsed.filter((c) => c.setCode);
    const withoutSet = parsed.filter((c) => !c.setCode);

    let created = 0;
    let updated = 0;
    const updatedNames: string[] = [];
    const errors: string[] = [];

    // Process cards with set code individually (prefer exact printing)
    for (const { cardName, quantity, setCode, isFoil } of withSet) {
      await new Promise((r) => setTimeout(r, 200));
      let scryfall = setCode ? await searchCardWithSet(cardName, setCode) : null;
      if (!scryfall) scryfall = await searchCard(cardName);
      if (scryfall) {
        const action = await upsertItem(collectionId, quantity, scryfall, isFoil || false);
        if (action === "created") created++;
        else { updated++; updatedNames.push(scryfall.name); }
      } else {
        errors.push(`${cardName}: not found on Scryfall`);
      }
    }

    // Batch-resolve cards without set info
    if (withoutSet.length > 0) {
      // Deduplicate by name
      const nameToQty = new Map<string, number>();
      for (const { cardName, quantity } of withoutSet) {
        nameToQty.set(cardName, (nameToQty.get(cardName) || 0) + quantity);
      }
      const batchNames = [...nameToQty.keys()];

      const collRes = await fetch("https://api.scryfall.com/cards/collection", {
        method: "POST",
        headers: { "User-Agent": "MTGCollection/1.0", "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batchNames.map((name) => ({ name })) }),
      });

      const resolved = new Map<string, ScryfallResult>();
      let notFound: string[] = [];

      if (collRes.ok) {
        const collData = await collRes.json();
        if (collData.data) {
          for (const card of collData.data as ScryfallResult[]) {
            if (!card.digital && hasPrice(card)) resolved.set(card.name.toLowerCase(), card);
          }
          for (const card of collData.data as ScryfallResult[]) {
            const key = card.name.toLowerCase();
            if (!resolved.has(key) && !card.digital) resolved.set(key, card);
          }
          for (const card of collData.data as ScryfallResult[]) {
            const key = card.name.toLowerCase();
            if (!resolved.has(key)) resolved.set(key, card);
          }
        }
        if (collData.not_found) {
          notFound = collData.not_found.map((n: any) => typeof n === "string" ? n : n.name).filter(Boolean);
        }
      } else {
        notFound = [...batchNames];
      }

      for (const name of batchNames) {
        const found = resolved.get(name.toLowerCase());
        if (found) {
          const qty = nameToQty.get(name) || 1;
          const action = await upsertItem(collectionId, qty, found);
          if (action === "created") created++;
          else { updated++; updatedNames.push(found.name); }
        } else if (!notFound.includes(name)) {
          notFound.push(name);
        }
      }

      for (const name of notFound) {
        await new Promise((r) => setTimeout(r, 200));
        const scryfall = await searchCard(name);
        if (scryfall) {
          const qty = nameToQty.get(name) || 1;
          const action = await upsertItem(collectionId, qty, scryfall);
          if (action === "created") created++;
          else { updated++; updatedNames.push(scryfall.name); }
        } else {
          errors.push(`${name}: not found on Scryfall`);
        }
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
