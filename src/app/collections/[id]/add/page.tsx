"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface CardPrinting {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  image_uris?: { small: string };
  card_faces?: { image_uris?: { small: string } }[];
  prices?: { usd: string | null; usd_foil: string | null };
}

export default function AddCard() {
  const params = useParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [prints, setPrints] = useState<CardPrinting[]>([]);
  const [selectedPrint, setSelectedPrint] = useState<CardPrinting | null>(null);
  const [condition, setCondition] = useState("NM");
  const [isFoil, setIsFoil] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (query.length < 2 || selectedName) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/scryfall/autocomplete?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setSuggestions(json.data || []);
      setShowSuggestions(true);
    }, 200);
  }, [query, selectedName]);

  const selectCard = (name: string) => {
    setQuery(name);
    setSelectedName(name);
    setShowSuggestions(false);
    setSelectedPrint(null);
    fetch(`/api/scryfall/search?q=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((json) => setPrints(json.data || []));
  };

  const imageUrl = (card: CardPrinting) =>
    card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || null;

  const addToCollection = async () => {
    if (!selectedPrint) return;
    setSaving(true);
    const print = selectedPrint;
    await fetch(`/api/collections/${params.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scryfallId: print.id,
        oracleId: print.oracle_id,
        cardName: print.name,
        setCode: print.set,
        setName: print.set_name,
        imageUrl: imageUrl(print),
        condition,
        isFoil,
        quantity,
        priceUsd: print.prices?.usd ? parseFloat(print.prices.usd) : null,
        priceUsdFoil: print.prices?.usd_foil ? parseFloat(print.prices.usd_foil) : null,
      }),
    });
    setSaving(false);
    router.push(`/collections/${params.id}`);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Card</h1>

      <div className="rounded-xl border bg-white p-6 max-w-2xl">
        <label className="block mb-2 text-sm font-medium">Card Name</label>
        <div className="relative mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedName) {
                setSelectedName("");
                setPrints([]);
                setSelectedPrint(null);
              }
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Start typing a card name..."
            autoFocus
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-60 overflow-auto">
              {suggestions.map((name) => (
                <button
                  key={name}
                  onMouseDown={() => selectCard(name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedName && prints.length > 0 && !selectedPrint && (
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium">
              Select Printing ({prints.length} available)
            </label>
            <div className="max-h-64 overflow-auto rounded-lg border">
              {prints.map((print) => (
                <button
                  key={print.id}
                  onClick={() => setSelectedPrint(print)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-100 border-b last:border-0 text-left"
                >
                  {imageUrl(print) ? (
                    <img src={imageUrl(print)!} alt="" className="w-6 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-6 h-8 rounded bg-zinc-200" />
                  )}
                  <span className="font-medium">{print.set_name}</span>
                  <span className="text-zinc-400">({print.set.toUpperCase()})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPrint && (
          <div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-zinc-50">
              {imageUrl(selectedPrint) ? (
                <img src={imageUrl(selectedPrint)!} alt="" className="w-10 h-14 rounded object-cover" />
              ) : null}
              <div>
                <p className="font-medium">{selectedPrint.name}</p>
                <p className="text-sm text-zinc-500">
                  {selectedPrint.set_name} ({selectedPrint.set.toUpperCase()})
                </p>
              </div>
              <button
                onClick={() => setSelectedPrint(null)}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-700"
              >
                Change
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block mb-1 text-sm font-medium">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Moderately Played (MP)</option>
                  <option value="HP">Heavily Played (HP)</option>
                  <option value="DMG">Damaged (DMG)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Foil</label>
                <select
                  value={isFoil ? "yes" : "no"}
                  onChange={(e) => setIsFoil(e.target.value === "yes")}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              onClick={addToCollection}
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add to Collection"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
