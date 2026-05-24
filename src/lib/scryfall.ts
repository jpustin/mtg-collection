const SCRYFALL_API = "https://api.scryfall.com";

export async function autocompleteCards(query: string) {
  const res = await fetch(
    `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": "MTGCollectionApp/1.0" } }
  );
  if (!res.ok) return { data: [] as string[] };
  const json = await res.json();
  return { data: json.data as string[] };
}

export async function searchCards(query: string) {
  const all: ScryfallCard[] = [];
  let url: string | null = `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}&unique=prints`;
  let pages = 0;
  while (url && pages < 5) {
    const res: Response = await fetch(url, {
      headers: { "User-Agent": "MTGCollectionApp/1.0" },
    });
    if (!res.ok) break;
    const json = await res.json();
    all.push(...(json.data as ScryfallCard[]));
    url = json.has_more ? (json.next_page as string) : null;
    pages++;
  }
  return { data: all };
}

export async function getCardById(scryfallId: string) {
  const res = await fetch(`${SCRYFALL_API}/cards/${scryfallId}`, {
    headers: { "User-Agent": "MTGCollectionApp/1.0" },
  });
  if (!res.ok) return null;
  return (await res.json()) as ScryfallCard;
}

export async function getAllSets() {
  const res = await fetch(`${SCRYFALL_API}/sets`, {
    headers: { "User-Agent": "MTGCollectionApp/1.0" },
  });
  if (!res.ok) return { data: [] as ScryfallSet[] };
  const json = await res.json();
  return { data: json.data as ScryfallSet[] };
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
  };
  card_faces?: {
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }[];
  lang?: string;
  prices?: {
    usd: string | null;
    usd_foil: string | null;
    eur: string | null;
    eur_foil: string | null;
    tix: string | null;
  };
  purchase_uris?: {
    tcgplayer?: string | null;
    cardmarket?: string | null;
    cardhoarder?: string | null;
  };
}

export interface ScryfallSet {
  code: string;
  name: string;
  released_at: string;
  icon_svg_uri?: string;
}
