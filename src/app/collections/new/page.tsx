"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCollection() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      router.push("/");
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-6">New Collection</h1>
      <form onSubmit={create} className="rounded-xl border bg-white p-6 max-w-md">
        <label className="block mb-2 text-sm font-medium">Collection Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm mb-4"
          placeholder="e.g. My Standard Deck"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Collection"}
        </button>
      </form>
    </div>
  );
}
