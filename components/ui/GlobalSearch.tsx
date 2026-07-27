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
  score: number;
}

// Score de correspondance floue : sous-séquence des lettres de `query` dans `text`, tolère
// fautes de frappe/lettres manquantes/ordre imparfait. 0 = pas de match, plus haut = meilleur.
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1000 - (t.indexOf(q) === 0 ? 0 : 10) + Math.max(0, 50 - t.length);

  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += streak; // bonus pour lettres consécutives
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : 0;
}

const MAX_SCANNED_CARDS = 2000; // évite de rapatrier des decks entiers pour un compte très volumineux

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const poolRef = useRef<SearchResult[] | null>(null);

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
      loadPool();
    }
  }, [open]);

  // Charge une seule fois à l'ouverture tout ce qui est fouillable (decks + cartes), pour permettre
  // un scoring flou (tolérant aux fautes de frappe) côté client sans aller-retour DB par frappe.
  const loadPool = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: decks }, { data: cards }] = await Promise.all([
      supabase.from("decks").select("id, name, description").eq("user_id", user.id),
      supabase
        .from("cards")
        .select("id, front, back, deck_id, tags")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_SCANNED_CARDS),
    ]);

    const pool: SearchResult[] = [];
    if (decks) {
      for (const d of decks) {
        pool.push({ type: "deck", id: d.id, title: d.name, subtitle: d.description || "Deck", score: 0 });
      }
    }
    if (cards) {
      const deckIds = [...new Set(cards.map((c) => c.deck_id))];
      const { data: cardDecks } = deckIds.length
        ? await supabase.from("decks").select("id, name").in("id", deckIds)
        : { data: [] as { id: string; name: string }[] };
      const deckMap = new Map((cardDecks ?? []).map((d) => [d.id, d.name]));
      const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
      for (const c of cards) {
        pool.push({
          type: "card",
          id: c.id,
          deckId: c.deck_id,
          deckName: deckMap.get(c.deck_id) || "Deck",
          title: stripHtml(c.front).slice(0, 80),
          subtitle: stripHtml(c.back).slice(0, 80),
          tags: c.tags,
          score: 0,
        });
      }
    }
    poolRef.current = pool;
    setLoading(false);
  }, [supabase]);

  const search = useCallback((q: string) => {
    const term = q.trim();
    if (!term || !poolRef.current) { setResults([]); return; }

    const scored = poolRef.current
      .map((item) => {
        const haystack = `${item.title} ${item.subtitle} ${(item.tags ?? []).join(" ")}`;
        return { ...item, score: fuzzyScore(term, haystack) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    setResults(scored);
    setSelectedIdx(0);
  }, []);

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
