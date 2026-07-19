"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "deck" | "card";
  id: string;
  deckId?: string;
  deckName?: string;
  title: string;
  subtitle: string;
  tags?: string[];
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) { setResults([]); return; }
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const term = `%${q.trim()}%`;
      const res: SearchResult[] = [];

      // Search decks
      const { data: decks } = await supabase
        .from("decks")
        .select("id, name, description")
        .eq("user_id", user.id)
        .or(`name.ilike.${term},description.ilike.${term}`)
        .limit(5);

      if (decks) {
        for (const d of decks) {
          res.push({
            type: "deck",
            id: d.id,
            title: d.name,
            subtitle: d.description || "Deck",
          });
        }
      }

      // Search cards (front/back)
      const { data: cards } = await supabase
        .from("cards")
        .select("id, front, back, deck_id, tags")
        .eq("user_id", user.id)
        .or(`front.ilike.${term},back.ilike.${term}`)
        .limit(10);

      if (cards) {
        // Get deck names for card results
        const deckIds = [...new Set(cards.map((c) => c.deck_id))];
        const { data: cardDecks } = await supabase
          .from("decks")
          .select("id, name")
          .in("id", deckIds);

        const deckMap = new Map((cardDecks ?? []).map((d) => [d.id, d.name]));

        for (const c of cards) {
          const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
          res.push({
            type: "card",
            id: c.id,
            deckId: c.deck_id,
            deckName: deckMap.get(c.deck_id) || "Deck",
            title: stripHtml(c.front).slice(0, 80),
            subtitle: stripHtml(c.back).slice(0, 80),
            tags: c.tags,
          });
        }
      }

      setResults(res);
      setSelectedIdx(0);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  function navigate(r: SearchResult) {
    setOpen(false);
    if (r.type === "deck") {
      router.push(`/decks/${r.id}`);
    } else {
      router.push(`/decks/${r.deckId}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      e.preventDefault();
      navigate(results[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Search panel */}
      <div className="relative w-full max-w-lg mx-4 bg-[var(--navy-light)] border border-[rgba(201,165,82,0.2)] rounded-xl shadow-2xl overflow-hidden animate-fade-slide">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--navy-mid)]">
          <svg className="w-5 h-5 text-[var(--gold)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeWidth="2" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher dans tous les decks et cartes..."
            className="flex-1 bg-transparent text-[var(--white)] text-sm outline-none placeholder-[var(--slate)]"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--navy)] text-[var(--slate)] text-[10px] font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center text-sm text-[var(--slate)]">Recherche...</div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--slate)]">
              Aucun résultat pour &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-1">
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigate(r)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors ${
                    i === selectedIdx ? "bg-[rgba(201,165,82,0.1)]" : "hover:bg-[rgba(201,165,82,0.05)]"
                  }`}
                >
                  {/* Icon */}
                  <span className="text-sm mt-0.5 shrink-0">
                    {r.type === "deck" ? "📚" : "🃏"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.title}</span>
                      {r.type === "card" && r.deckName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--navy)] text-[var(--slate)] shrink-0">
                          {r.deckName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--slate)] truncate">{r.subtitle}</div>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {r.tags.map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(201,165,82,0.15)] text-[var(--gold)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {i === selectedIdx && (
                    <span className="text-[10px] text-[var(--slate)] mt-1 shrink-0">Entrée ↵</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!query && (
            <div className="px-4 py-6 text-center text-sm text-[var(--slate)]">
              Tape pour chercher dans tous tes decks et cartes
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--navy-mid)] flex items-center gap-4 text-[10px] text-[var(--slate)]">
          <span><kbd className="font-mono">↑↓</kbd> naviguer</span>
          <span><kbd className="font-mono">Entrée</kbd> ouvrir</span>
          <span><kbd className="font-mono">Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
