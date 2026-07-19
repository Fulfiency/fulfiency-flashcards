"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import GoldButton from "@/components/ui/GoldButton";
import TextShimmer from "@/components/ui/TextShimmer";
import { playClick } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Onboarding from "@/components/ui/Onboarding";

function TagTreeView({ cards, decks }: {
  cards: { id: string; front: string; deck_id: string; tags: string[]; due: string }[];
  decks: Deck[];
}) {
  const router = useRouter();
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");

  // Group by tag
  const tagMap = new Map<string, typeof cards>();
  const untagged: typeof cards = [];
  for (const c of cards) {
    if (c.tags.length === 0) { untagged.push(c); continue; }
    for (const t of c.tags) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t)!.push(c);
    }
  }

  const sortedTags = [...tagMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const deckMap = new Map(decks.map((d) => [d.id, d]));

  function TagGroup({ tag, tagCards }: { tag: string; tagCards: typeof cards }) {
    const [expanded, setExpanded] = useState(false);
    const now = new Date();
    const dueCount = tagCards.filter((c) => new Date(c.due) <= now).length;

    return (
      <div>
        <div
          className="card-hover p-3 flex items-center gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <button className="w-5 h-5 flex items-center justify-center text-[var(--slate)] text-xs">
            {expanded ? "▼" : "▶"}
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,165,82,0.15)] text-[var(--gold)]">
            {tag}
          </span>
          <span className="text-xs text-[var(--slate)]">{tagCards.length} carte{tagCards.length > 1 ? "s" : ""}</span>
          {dueCount > 0 && (
            <span className="text-xs text-[var(--gold)] font-semibold">{dueCount} à réviser</span>
          )}
        </div>
        {expanded && (
          <div className="ml-8 mt-1 space-y-1">
            {tagCards.map((c) => {
              const deck = deckMap.get(c.deck_id);
              return (
                <div
                  key={c.id}
                  className="card-hover p-2 flex items-center gap-3 cursor-pointer text-sm"
                  onClick={() => router.push(`/decks/${c.deck_id}`)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: deck?.color ?? "var(--gold)" }} />
                  <span className="truncate flex-1">{stripHtml(c.front)}</span>
                  <span className="text-[10px] text-[var(--slate)] shrink-0">{deck?.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedTags.map(([tag, tagCards]) => (
        <TagGroup key={tag} tag={tag} tagCards={tagCards} />
      ))}
      {untagged.length > 0 && (
        <TagGroup tag="sans tag" tagCards={untagged} />
      )}
    </div>
  );
}

function DeckTreeNode({ deck, depth }: { deck: Deck; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = deck.children && deck.children.length > 0;
  const router = useRouter();

  return (
    <div>
      <div
        className="card-hover p-4 animate-fade-slide flex items-center gap-3 cursor-pointer"
        style={{ marginLeft: depth * 24 }}
        onClick={() => router.push(`/decks/${deck.id}`)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-5 h-5 flex items-center justify-center text-[var(--slate)] hover:text-[var(--gold)] transition-colors text-xs"
          >
            {expanded ? "▼" : "▶"}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: deck.color }} />

        <div className="flex-1 min-w-0">
          <h3 className="font-[family-name:var(--font-playfair-display)] font-bold truncate">{deck.name}</h3>
          <div className="flex items-center gap-3 text-xs text-[var(--slate)]">
            <span>{deck.totalCount} carte{deck.totalCount > 1 ? "s" : ""}</span>
            {deck.dueCount > 0 && (
              <span className="text-[var(--gold)] font-semibold">{deck.dueCount} à réviser</span>
            )}
            {hasChildren && (
              <span>{deck.children!.length} sous-deck{deck.children!.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {deck.dueCount > 0 && (
            <Link href={`/review/${deck.id}`} className="btn-gold text-xs py-1.5 px-3">Réviser</Link>
          )}
          <Link
            href={`/cram/${deck.id}`}
            className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(201,165,82,0.2)] text-[var(--gold)] hover:bg-[rgba(201,165,82,0.1)] transition-colors"
          >
            Cram
          </Link>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {deck.children!.map((child) => (
            <DeckTreeNode key={child.id} deck={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface Deck {
  id: string;
  name: string;
  color: string;
  totalCount: number;
  dueCount: number;
  parent_id: string | null;
  children?: Deck[];
}

export default function DashboardPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [totalDue, setTotalDue] = useState(0);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [streak, setStreak] = useState(0);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [todayReviews, setTodayReviews] = useState(0);
  const [viewMode, setViewMode] = useState<"decks" | "tags">("decks");
  const [allCards, setAllCards] = useState<{ id: string; front: string; deck_id: string; tags: string[]; due: string }[]>([]);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserName(user.email?.split("@")[0] ?? "");

      const [{ data: deckRows }, { data: allCards }] = await Promise.all([
        supabase.from("decks").select("id, name, color, parent_id").eq("user_id", user.id).order("name"),
        supabase.from("cards").select("id, front, deck_id, due, tags").eq("user_id", user.id),
      ]);

      if (!deckRows) { setLoading(false); return; }

      const now = new Date();
      setAllCards((allCards ?? []).map((c: any) => ({ ...c, tags: c.tags ?? [] })));
      const cardsByDeck = new Map<string, { total: number; due: number }>();
      for (const c of (allCards ?? [])) {
        const entry = cardsByDeck.get(c.deck_id) ?? { total: 0, due: 0 };
        entry.total++;
        if (new Date(c.due) <= now) entry.due++;
        cardsByDeck.set(c.deck_id, entry);
      }

      const enriched: Deck[] = [];
      let tTotal = 0;
      let tDue = 0;

      for (const d of deckRows) {
        const stats = cardsByDeck.get(d.id) ?? { total: 0, due: 0 };
        tTotal += stats.total;
        tDue += stats.due;
        enriched.push({ ...d, parent_id: d.parent_id ?? null, totalCount: stats.total, dueCount: stats.due });
      }

      setDecks(enriched);
      setTotalCards(tTotal);
      setTotalDue(tDue);

      // Streak + heatmap
      const { data: logs } = await supabase
        .from("review_logs")
        .select("review")
        .eq("user_id", user.id)
        .order("review", { ascending: false })
        .limit(5000);

      if (logs) {
        // Heatmap 60 days
        const hm = new Map<string, number>();
        for (let i = 59; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          hm.set(d.toISOString().slice(0, 10), 0);
        }
        for (const l of logs) {
          const ds = l.review?.slice(0, 10);
          if (ds && hm.has(ds)) hm.set(ds, (hm.get(ds) ?? 0) + 1);
        }
        setHeatmap(hm);

        // Today count
        const todayStr = new Date().toISOString().slice(0, 10);
        setTodayReviews(hm.get(todayStr) ?? 0);

        // Streak
        const days = new Set(logs.map((l) => l.review?.slice(0, 10)));
        let s = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
          const d = new Date(today); d.setDate(d.getDate() - i);
          const ds = d.toISOString().slice(0, 10);
          if (days.has(ds)) s++;
          else if (i > 0) break;
        }
        setStreak(s);
      }

      setLoading(false);
    }
    load();
  }, []);

  const filtered = decks.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  // Build tree
  function buildTree(list: Deck[]): Deck[] {
    const map = new Map<string, Deck>();
    const roots: Deck[] = [];
    for (const d of list) map.set(d.id, { ...d, children: [] });
    for (const d of map.values()) {
      if (d.parent_id && map.has(d.parent_id)) {
        map.get(d.parent_id)!.children!.push(d);
      } else {
        roots.push(d);
      }
    }
    return roots;
  }

  const deckTree = buildTree(filtered);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--slate)]">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <Onboarding />
      <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold mb-6">
        Bonjour, <TextShimmer>{userName}</TextShimmer>
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "À réviser", value: totalDue, accent: "var(--gold)" },
          { label: "Total cartes", value: totalCards, accent: "var(--slate)" },
          { label: "Decks", value: decks.length, accent: "var(--sage)" },
          { label: streak > 0 ? "Streak 🔥" : "Streak", value: streak, accent: streak > 0 ? "var(--gold)" : "var(--slate)" },
        ].map((kpi) => (
          <div key={kpi.label} className="card-hover p-4 text-center animate-kpi">
            <div
              className="text-3xl font-bold mb-1"
              style={{ color: kpi.accent }}
            >
              {kpi.value}
            </div>
            <div className="text-xs text-[var(--slate)]">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Activity heatmap */}
      {heatmap.size > 0 && (
        <div className="card-hover p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--slate)]">Activité (60 jours)</span>
            {streak > 0 && <span className="text-xs text-[var(--gold)] streak-fire">{streak} jour{streak > 1 ? "s" : ""} de suite</span>}
          </div>
          <div className="flex flex-wrap gap-[3px]">
            {Array.from(heatmap.entries()).map(([date, count]) => {
              const max = Math.max(...Array.from(heatmap.values()), 1);
              return (
                <div
                  key={date}
                  title={`${date}: ${count} révision${count > 1 ? "s" : ""}`}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    background: count === 0
                      ? "var(--navy-mid)"
                      : `rgba(201, 165, 82, ${0.2 + (count / max) * 0.8})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Daily goal */}
      {(() => {
        const goal = getSettings().dailyGoal;
        const pct = Math.min(100, (todayReviews / goal) * 100);
        const done = todayReviews >= goal;
        return (
          <div className="card-hover p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--slate)]">Objectif du jour</span>
              <span className={`text-xs font-bold ${done ? "text-[var(--sage)]" : "text-[var(--gold)]"}`}>
                {todayReviews} / {goal} {done ? "✓" : ""}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[var(--navy-mid)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${done ? "animate-glow" : ""}`}
                style={{
                  width: `${pct}%`,
                  background: done
                    ? "linear-gradient(90deg, var(--sage), #8fac87)"
                    : "linear-gradient(90deg, var(--gold), var(--gold-light))",
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Search + header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <h2 className="font-[family-name:var(--font-playfair-display)] text-xl font-bold">
            Mes decks
          </h2>
          <div className="flex gap-0.5 bg-[var(--navy)] rounded-lg p-0.5">
            {(["decks", "tags"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewMode === m ? "bg-[var(--gold)] text-[var(--navy)]" : "text-[var(--slate)] hover:text-[var(--white)]"
                }`}
              >
                {m === "decks" ? "Decks" : "Tags"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--slate)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeWidth="2" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un deck..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--slate)] hover:text-[var(--white)] text-sm"
              >
                ✕
              </button>
            )}
          </div>
          <GoldButton
            onClick={() => { if (getSettings().soundEnabled) playClick(); router.push("/create"); }}
            className="text-xs py-2 px-4 shrink-0"
          >
            + Nouveau
          </GoldButton>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="card-hover p-12 text-center">
          <p className="text-[var(--slate)] mb-4 text-lg">
            Aucun deck pour le moment
          </p>
          <p className="text-[var(--slate)] text-sm mb-6">
            Crée ton premier deck et commence à mémoriser !
          </p>
          <GoldButton onClick={() => router.push("/create")}>
            Créer mon premier deck
          </GoldButton>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-hover p-8 text-center">
          <p className="text-[var(--slate)]">Aucun deck trouvé pour &ldquo;{search}&rdquo;</p>
        </div>
      ) : viewMode === "decks" ? (
        <div className="space-y-2">
          {deckTree.map((d) => (
            <DeckTreeNode key={d.id} deck={d} depth={0} />
          ))}
        </div>
      ) : (
        <TagTreeView cards={allCards} decks={decks} />
      )}
    </div>
  );
}
