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
  priceUpdatedAt: string | null;
}

export default function CollectionDetail() {
  const params = useParams();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [collectionName, setCollectionName] = useState("");

  useEffect(() => {
    fetch(`/api/collections/${params.id}`)
      .then((r) => r.json())
      .then((data) => setCollectionName(data.name || ""));
    fetch(`/api/collections/${params.id}/items`)
      .then((r) => r.json())
      .then(setItems);
  }, [params.id]);

  const updateItem = async (itemId: string, changes: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...changes } : i)));
    await fetch(`/api/collections/${params.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
  };

  const totalValue = items.reduce((sum, i) => {
    if (i.game === "mtgo") return sum + (i.priceTix || 0) * i.quantity;
    const price = i.isFoil ? i.priceUsdFoil : i.priceUsd;
    return sum + (price || 0) * i.quantity;
  }, 0);

  const hasMtgo = items.length > 0 && items.some((i) => i.game === "mtgo");

  const deleteCollection = async () => {
    if (!confirm("Delete this entire collection?")) return;
    await fetch(`/api/collections/${params.id}`, { method: "DELETE" });
    router.push("/");
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

  const priceDisplay = (item: Item) => {
    const price = item.game === "mtgo" ? item.priceTix : item.isFoil ? item.priceUsdFoil : item.priceUsd;
    return price != null ? price : 0;
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

      <div className="mb-4 text-sm text-zinc-600">
        {items.length} card{items.length !== 1 ? "s" : ""} &middot;{" "}
        Est. value: <span className="font-semibold">{hasMtgo ? "" : "$"}{totalValue.toFixed(2)}{hasMtgo ? " TIX" : ""}</span>
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
                const price = priceDisplay(item);
                const symbol = item.game === "mtgo" ? "" : "$";
                const suffix = item.game === "mtgo" ? " TIX" : "";

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
                    <td className="px-4 py-3 text-zinc-600">{item.setName}</td>
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
                      {price ? `${symbol}${price.toFixed(2)}${suffix}` : "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {price ? `${symbol}${(price * item.quantity).toFixed(2)}${suffix}` : "-"}
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
    </div>
  );
}
