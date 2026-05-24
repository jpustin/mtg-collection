"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { priceDisplay } from "@/lib/pricing";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchAll = () => {
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
            const p = priceDisplay(i);
            if (!p) continue;
            const sub = p.value * i.quantity;
            if (p.source === "cardmarket") eur += sub;
            else if (p.source === "mtgo") tix += sub;
            else usd += sub;
          }
          totals[c.id] = { usd, eur, tix };
        }
        setItemsData(totals);
      });
  };

  useEffect(() => { fetchAll() }, []);

  const rename = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    fetchAll();
  };

  const del = async (id: string) => {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    fetchAll();
  };

  const totalUsd = Object.values(itemsData).reduce((a, b) => a + b.usd, 0);
  const totalEur = Object.values(itemsData).reduce((a, b) => a + b.eur, 0);
  const totalTix = Object.values(itemsData).reduce((a, b) => a + b.tix, 0);
  const totalCards = collections.reduce((s, c) => s + c._count.items, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className="rounded-xl border bg-white p-4"
              >
                {isEditing ? (
                  <div>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename(c.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded border px-2 py-1 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => rename(c.id)}
                        className="text-xs rounded border border-zinc-300 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs rounded border border-zinc-300 px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Link href={`/collections/${c.id}`} className="flex-1 min-w-0 hover:opacity-80">
                      <p className="font-medium truncate">{c.name}</p>
                      <p className="text-sm text-zinc-500">
                        {c._count.items} card{c._count.items !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        ${d.usd.toFixed(2)} USD &middot; A${(d.usd * (audRate || 1.5)).toFixed(2)} AUD
                      </p>
                    </Link>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditingId(c.id); setEditName(c.name); }}
                        className="text-xs rounded border border-zinc-300 px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                      >
                        Rename
                      </button>
                      {confirmDelete === c.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => del(c.id)}
                            className="text-xs rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs rounded border border-zinc-300 px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(c.id)}
                          className="text-xs rounded border border-red-300 px-2 py-1 text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
