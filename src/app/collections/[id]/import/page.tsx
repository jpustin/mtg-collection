"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "url">("text");
  const [deckText, setDeckText] = useState("");
  const [deckUrl, setDeckUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    total: number;
    updatedNames?: string[];
    errors?: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const doImport = async () => {
    setImporting(true);
    setError("");
    setResult(null);
    try {
      let body: Record<string, string>;
      let endpoint: string;

      if (mode === "text") {
        endpoint = "/api/moxfield/import";
        body = { collectionId: params.id as string, deckText };
      } else {
        endpoint = "/api/deck/import";
        body = { collectionId: params.id as string, url: deckUrl };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "moxfield_blocked") {
          setError("Moxfield URL import is not available. Switch to Paste Text mode and paste your deck list from Moxfield's Export option.");
        } else {
          setError(data.error || "Import failed");
        }
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  };

  const canSubmit = mode === "text" ? deckText.trim() : deckUrl.trim();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/collections/${params.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">Import Deck</h1>
      </div>

      <div className="rounded-xl border bg-white p-4 sm:p-6 max-w-xl">
        <div className="flex gap-1 mb-5 p-1 rounded-lg bg-zinc-100 w-fit">
          <button
            onClick={() => setMode("text")}
            className={`px-3 py-1.5 text-sm rounded-md ${mode === "text" ? "bg-white shadow-sm font-medium" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setMode("url")}
            className={`px-3 py-1.5 text-sm rounded-md ${mode === "url" ? "bg-white shadow-sm font-medium" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            Import from URL
          </button>
        </div>

        {mode === "text" ? (
          <>
            <label className="block mb-2 text-sm font-medium">Paste Deck List</label>
            <p className="text-xs text-zinc-500 mb-3">
              Paste cards from any deck builder. Format: <code>4 Lightning Bolt</code> or <code>1 Sol Ring</code>. One card per line.
            </p>
            <textarea
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder={`4 Lightning Bolt\n2 Counterspell\n1 Sol Ring\nSB: 1 Surgical Extraction`}
              rows={10}
              className="w-full rounded-lg border px-3 py-2 text-sm mb-4 font-mono"
            />
          </>
        ) : (
          <>
            <label className="block mb-2 text-sm font-medium">Deck URL</label>
            <p className="text-xs text-zinc-500 mb-3">
              Paste a public deck URL from Archidekt.
            </p>
            <input
              type="url"
              value={deckUrl}
              onChange={(e) => setDeckUrl(e.target.value)}
              placeholder="https://archidekt.com/decks/12345"
              className="w-full rounded-lg border px-3 py-2 text-sm mb-4"
            />
            <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <p className="font-medium mb-1">Moxfield users</p>
              <p>Moxfield doesn't allow automated imports. On your deck page, click <strong>Export → Copy</strong> (top-right), then switch to <button onClick={() => setMode("text")} className="text-blue-600 underline">Paste Text</button> and paste.</p>
            </div>
          </>
        )}

        <button
          onClick={doImport}
          disabled={importing || !canSubmit}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import Cards"}
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 text-sm text-green-700">
            <p className="font-medium mb-1">
              {result.created > 0 && <span>{result.created} new</span>}
              {result.created > 0 && result.updated > 0 && <span> &middot; </span>}
              {result.updated > 0 && <span className="text-amber-700">{result.updated} updated</span>}
              <span> &mdash; {result.total} total</span>
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
              onClick={() => router.push(`/collections/${params.id}${result.updatedNames ? `?updated=${encodeURIComponent(result.updatedNames.join(","))}` : ""}`)}
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
