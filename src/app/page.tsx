"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Collection {
  id: string;
  name: string;
  createdAt: string;
  _count: { items: number };
  _sum?: { totalValue: number | null };
}

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [itemsData, setItemsData] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(async (cols: Collection[]) => {
        setCollections(cols);
        const totals: Record<string, number> = {};
        for (const c of cols) {
          const res = await fetch(`/api/collections/${c.id}/items`);
          const items = await res.json();
          totals[c.id] = items.reduce((sum: number, i: any) => {
            const price = i.isFoil ? i.priceUsdFoil : i.priceUsd;
            return sum + (price || 0) * i.quantity;
          }, 0);
        }
        setItemsData(totals);
      });
  }, []);

  const totalValue = Object.values(itemsData).reduce((a, b) => a + b, 0);
  const totalCards = collections.reduce((s, c) => s + c._count.items, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Collections</p>
          <p className="text-2xl font-bold">{collections.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Total Cards</p>
          <p className="text-2xl font-bold">{totalCards}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-zinc-500">Est. Value</p>
          <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
        </div>
      </div>

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
          {collections.map((c) => (
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
              <p className="font-semibold">
                ${(itemsData[c.id] || 0).toFixed(2)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
