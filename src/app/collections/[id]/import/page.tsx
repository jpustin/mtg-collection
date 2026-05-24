"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const [deckUrl, setDeckUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    total: number;
    errors?: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const doImport = async () => {
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/moxfield/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: params.id, deckUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/collections/${params.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold">Import from Moxfield</h1>
      </div>

      <div className="rounded-xl border bg-white p-6 max-w-xl">
        <label className="block mb-2 text-sm font-medium">Moxfield Deck URL</label>
        <input
          type="text"
          value={deckUrl}
          onChange={(e) => setDeckUrl(e.target.value)}
          placeholder="https://moxfield.com/decks/..."
          className="w-full rounded-lg border px-3 py-2 text-sm mb-4"
        />
        <button
          onClick={doImport}
          disabled={importing || !deckUrl}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import Deck"}
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 text-sm text-green-700">
            <p className="font-medium mb-1">
              Imported {result.imported} of {result.total} cards
            </p>
            {result.errors && result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-600">
                  {result.errors.length} card{result.errors.length !== 1 ? "s" : ""} not found
                </summary>
                <ul className="mt-1 ml-4 list-disc text-red-600">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
            <button
              onClick={() => router.push(`/collections/${params.id}`)}
              className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              View Collection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
