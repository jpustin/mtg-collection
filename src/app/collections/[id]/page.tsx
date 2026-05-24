"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Item {
  id: string;
  cardName: string;
  setCode: string;
  setName: string;
  imageUrl: string | null;
  condition: string;
  isFoil: boolean;
  quantity: number;
  game: string;
  priceUsd: number | null;
  priceUsdFoil: number | null;
  priceTix: number | null;
  priceEur: number | null;
  priceEurFoil: number | null;
  priceUpdatedAt: string | null;
}

interface CardPrint {
  id: string;
  scryfallId: string;
  setCode: string;
  setName: string;
  imageUrl: string | null;
}

export default function CollectionDetail() {
  const params = useParams();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [audRate, setAudRate] = useState<number | null>(null);
  const [setPickerItem, setSetPickerItem] = useState<Item | null>(null);
  const [prints, setPrints] = useState<CardPrint[]>([]);
  const [setSearch, setSetSearch] = useState("");




  useEffect(() => {
    fetch(`/api/collections/${params.id}`)
      .then((r) => r.json())
      .then((data) => setCollectionName(data.name || ""));
    fetch(`/api/collections/${params.id}/items`)
      .then((r) => r.json())
      .then(setItems);
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => setAudRate(data.aud));
  }, [params.id]);

  const priceDisplay = (item: Item) => {
    if (item.game === "mtgo") return { value: item.priceTix ?? 0, source: "tcgplayer", symbol: "", suffix: " TIX" };
    if (item.isFoil && item.priceUsdFoil != null) return { value: item.priceUsdFoil, source: "tcgplayer", symbol: "$", suffix: "" };
    if (item.priceUsd != null) return { value: item.priceUsd, source: "tcgplayer", symbol: "$", suffix: "" };
    if (item.priceUsdFoil != null) return { value: item.priceUsdFoil, source: "tcgplayer", symbol: "$", suffix: "" };
    if (item.priceEur != null) return { value: item.priceEur, source: "cardmarket", symbol: "€", suffix: "" };
    if (item.priceEurFoil != null) return { value: item.priceEurFoil, source: "cardmarket", symbol: "€", suffix: "" };
    return null;
  };

  const updateItem = async (itemId: string, changes: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...changes } : i)));
    await fetch(`/api/collections/${params.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
  };

  const totals = items.reduce(
    (acc, i) => {
      const p = priceDisplay(i);
      if (!p) return acc;
      if (p.symbol === "$") acc.usd += p.value * i.quantity;
      else if (p.symbol === "€") acc.eur += p.value * i.quantity;
      else if (p.suffix === " TIX") acc.tix += p.value * i.quantity;
      return acc;
    },
    { usd: 0, eur: 0, tix: 0 }
  );

  const totalUsdLine = items.length > 0 && items.some((i) => i.game !== "mtgo");

  const deleteCollection = async () => {
    if (!confirm("Delete this entire collection?")) return;
    await fetch(`/api/collections/${params.id}`, { method: "DELETE" });
    router.push("/");
  };

  const openSetPicker = (item: Item) => {
    setSetPickerItem(item);
    setSetSearch("");
    setPrints([]);
    fetch(`/api/scryfall/search?q=${encodeURIComponent(item.cardName)}`)
      .then((r) => r.json())
      .then((json) => {
        const ps: CardPrint[] = (json.data || []).map((c: any) => ({
          id: c.id,
          scryfallId: c.id,
          setCode: c.set,
          setName: c.set_name,
          imageUrl: c.image_uris?.small || c.card_faces?.[0]?.image_uris?.small || null,
        }));
        setPrints(ps);
      })
      .catch(() => {});
  };

  const changeSet = async (itemId: string, print: CardPrint, originalItem: Item) => {
    const res = await fetch(`https://api.scryfall.com/cards/${print.scryfallId}`, {
      headers: { "User-Agent": "MTGCollectionApp/1.0" },
    });
    if (!res.ok) return;
    const card = await res.json();
    const changes = {
      scryfallId: card.id,
      oracleId: card.oracle_id,
      setCode: card.set,
      setName: card.set_name,
      imageUrl: print.imageUrl,
      game: "paper",
      priceUsd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
      priceUsdFoil: card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : null,
      priceEur: card.prices?.eur ? parseFloat(card.prices.eur) : null,
      priceEurFoil: card.prices?.eur_foil ? parseFloat(card.prices.eur_foil) : null,
      priceTix: card.prices?.tix ? parseFloat(card.prices.tix) : null,
    };
    await updateItem(itemId, changes);
    setSetPickerItem(null);
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/collections/${params.id}/items/${itemId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const refreshPrices = async () => {
    await fetch("/api/prices/refresh", { method: "POST" });
    const res = await fetch(`/api/collections/${params.id}/items`);
    setItems(await res.json());
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{collectionName || "Collection"}</h1>
        <div className="flex gap-2">
          <Link
            href={`/collections/${params.id}/add`}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Add Card
          </Link>
          <Link
            href={`/collections/${params.id}/import`}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Import
          </Link>
          <button
            onClick={refreshPrices}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Refresh Prices
          </button>
          <button
            onClick={deleteCollection}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-zinc-600 space-y-1">
        <div>{items.length} card{items.length !== 1 ? "s" : ""}</div>
        {totals.usd > 0 && (
          <div>
            Est. value: <span className="font-semibold">${totals.usd.toFixed(2)} USD</span>
            {audRate && <span className="ml-2 text-zinc-400">(A${(totals.usd * audRate).toFixed(2)} AUD)</span>}
          </div>
        )}
        {totals.eur > 0 && <div>EUR: <span className="font-semibold">€{totals.eur.toFixed(2)}</span></div>}
        {totals.tix > 0 && <div>TIX: <span className="font-semibold">{totals.tix.toFixed(2)} TIX</span></div>}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-zinc-500">
          <p className="mb-3">No cards in this collection yet</p>
          <Link
            href={`/collections/${params.id}/add`}
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            Add your first card
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-zinc-50 text-left">
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Set</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Foil</th>
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const p = priceDisplay(item);

                return (
                  <tr key={item.id} className="border-b hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="" className="w-8 h-11 rounded object-cover" />
                        )}
                        <span className="font-medium">{item.cardName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <button
                        onClick={() => openSetPicker(item)}
                        className="hover:underline cursor-pointer text-left"
                      >
                        {item.setName}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.condition}
                        onChange={(e) => updateItem(item.id, { condition: e.target.value })}
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-zinc-300 cursor-pointer"
                      >
                        <option value="NM">NM</option>
                        <option value="LP">LP</option>
                        <option value="MP">MP</option>
                        <option value="HP">HP</option>
                        <option value="DMG">DMG</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.isFoil ? "yes" : "no"}
                        onChange={(e) => updateItem(item.id, { isFoil: e.target.value === "yes" })}
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-zinc-300 cursor-pointer"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`rounded px-1.5 py-0.5 ${item.game === "mtgo" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
                        {item.game === "mtgo" ? "MTGO" : "Paper"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs w-14 hover:border-zinc-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {p ? (
                        <a
                          href={`https://scryfall.com/search?q=${encodeURIComponent(`!"${item.cardName}"`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {p.symbol}{p.value.toFixed(2)}{p.suffix}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {p ? `${p.symbol}${(p.value * item.quantity).toFixed(2)}${p.suffix}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {setPickerItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/20" onClick={() => setSetPickerItem(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-96 max-h-96 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b">
              <p className="text-sm font-medium mb-1">Change set: {setPickerItem.cardName}</p>
              <input
                type="text"
                value={setSearch}
                onChange={(e) => setSetSearch(e.target.value)}
                placeholder="Search sets..."
                className="w-full rounded border px-2 py-1 text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-auto">
              {prints.length === 0 && (
                <div className="p-4 text-sm text-zinc-400 text-center">Loading prints...</div>
              )}
              {prints
                .filter((p) =>
                  p.setName.toLowerCase().includes(setSearch.toLowerCase()) ||
                  p.setCode.toLowerCase().includes(setSearch.toLowerCase())
                )
                .slice(0, 50)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => changeSet(setPickerItem.id, p, setPickerItem)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 border-b last:border-0 flex items-center gap-3"
                  >
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" className="w-5 h-7 rounded object-cover" />
                    )}
                    <span>{p.setName}</span>
                    <span className="text-zinc-400 ml-auto">({p.setCode.toUpperCase()})</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
