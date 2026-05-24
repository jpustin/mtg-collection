"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  createdAt: string;
  _count: { items: number };
}

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [itemsData, setItemsData] = useState<Record<string, { usd: number; eur: number; tix: number }>>({});
  const [audRate, setAudRate] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => setAudRate(data.aud));
    fetch("/api/collections")
      .then((r) => r.json())
      .then(async (cols: Collection[]) => {
        setCollections(cols);
        const totals: Record<string, { usd: number; eur: number; tix: number }> = {};
        for (const c of cols) {
          const res = await fetch(`/api/collections/${c.id}/items`);
          const items = await res.json();
          let usd = 0, eur = 0, tix = 0;
          for (const i of items) {
            if (i.game === "mtgo") {
              tix += (i.priceTix || 0) * i.quantity;
            } else {
              const price = i.isFoil ? (i.priceUsdFoil ?? i.priceEurFoil ?? i.priceEur) : (i.priceUsd ?? i.priceEur);
              if (price != null) {
                if (i.priceUsd || i.priceUsdFoil) usd += (i.isFoil ? (i.priceUsdFoil ?? 0) : (i.priceUsd ?? 0)) * i.quantity;
                else eur += price * i.quantity;
              }
            }
          }
          totals[c.id] = { usd, eur, tix };
        }
        setItemsData(totals);
      });
  }, []);

  const totalUsd = Object.values(itemsData).reduce((a, b) => a + b.usd, 0);
  const totalEur = Object.values(itemsData).reduce((a, b) => a + b.eur, 0);
  const totalTix = Object.values(itemsData).reduce((a, b) => a + b.tix, 0);
  const totalCards = collections.reduce((s, c) => s + c._count.items, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Collections</p>
          <p className="text-2xl font-bold">{collections.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Total Cards</p>
          <p className="text-2xl font-bold">{totalCards}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Est. Value (USD)</p>
          <p className="text-2xl font-bold">${totalUsd.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Est. Value (AUD)</p>
          <p className="text-2xl font-bold">A${(totalUsd * (audRate || 1.5)).toFixed(2)}</p>
        </div>
      </div>
      {totalEur > 0 && <p className="text-sm text-zinc-500 -mt-4 mb-4">EUR: €{totalEur.toFixed(2)} &middot; TIX: {totalTix.toFixed(2)}</p>}

      <h2 className="text-lg font-semibold mb-3">Collections</h2>
      {collections.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-zinc-500">
          <p className="mb-3">No collections yet</p>
          <Link
            href="/collections/new"
            className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
          >
            Create your first collection
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((c) => {
            const d = itemsData[c.id] || { usd: 0, eur: 0, tix: 0 };
            return (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="flex items-center justify-between rounded-xl border bg-white p-4 hover:border-zinc-300 transition-colors"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-zinc-500">
                    {c._count.items} card{c._count.items !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${d.usd.toFixed(2)} USD</p>
                  <p className="text-xs text-zinc-400">A${(d.usd * (audRate || 1.5)).toFixed(2)} AUD</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
