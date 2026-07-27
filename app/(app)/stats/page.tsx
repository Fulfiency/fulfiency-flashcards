"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import GraphView from "@/components/ui/GraphView";

interface DayData {
  date: string;
  count: number;
}

interface RatingDist {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface ReviewLog {
  rating: number;
  review: string;
}

const RATING_LABELS: Record<number, string> = { 1: "À revoir", 2: "Difficile", 3: "Bien", 4: "Facile" };

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StatsPage() {
  const [dailyData, setDailyData] = useState<DayData[]>([]);
  const [ratingDist, setRatingDist] = useState<RatingDist>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [totalReviews, setTotalReviews] = useState(0);
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [streak, setStreak] = useState(0);
  const [avgPerDay, setAvgPerDay] = useState(0);
  const [bestDay, setBestDay] = useState({ date: "", count: 0 });
  const [totalCards, setTotalCards] = useState(0);
  const [matureCards, setMatureCards] = useState(0);
  const [newCards, setNewCards] = useState(0);
  const [avgTimePerCard, setAvgTimePerCard] = useState(0);
  const [graphDecks, setGraphDecks] = useState<{ id: string; name: string; color: string }[]>([]);
  const [graphCards, setGraphCards] = useState<{ id: string; front: string; deck_id: string; tags: string[] }[]>([]);
  const [rawLogs, setRawLogs] = useState<ReviewLog[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: logs } = await supabase
        .from("review_logs")
        .select("rating, review")
        .eq("user_id", user.id)
        .order("review", { ascending: false })
        .limit(5000);

      // Card states + graph data
      const [{ data: cards }, { data: decksData }, { data: graphCardsData }] = await Promise.all([
        supabase.from("cards").select("state, stability").eq("user_id", user.id),
        supabase.from("decks").select("id, name, color").eq("user_id", user.id),
        supabase.from("cards").select("id, front, deck_id, tags").eq("user_id", user.id),
      ]);

      if (decksData) setGraphDecks(decksData);
      if (graphCardsData) setGraphCards(graphCardsData.map((c) => ({ ...c, tags: c.tags ?? [] })));
      if (cards) {
        setTotalCards(cards.length);
        setNewCards(cards.filter((c) => c.state === 0).length);
        setMatureCards(cards.filter((c) => c.state === 2 && c.stability > 21).length);
      }

      if (!logs) return;

      setRawLogs(logs);
      setTotalReviews(logs.length);

      // Rating distribution
      const dist: RatingDist = { again: 0, hard: 0, good: 0, easy: 0 };
      const ratingMap: Record<number, keyof RatingDist> = { 1: "again", 2: "hard", 3: "good", 4: "easy" };
      for (const l of logs) {
        const k = ratingMap[l.rating];
        if (k) dist[k]++;
      }
      setRatingDist(dist);

      // Daily (7 days)
      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const count = logs.filter((l) => l.review?.slice(0, 10) === dateStr).length;
        days.push({ date: dateStr, count });
      }
      setDailyData(days);

      // Avg per day (last 30 days)
      const last30 = days.slice(-7);
      const avg30 = last30.reduce((a, d) => a + d.count, 0) / 7;
      setAvgPerDay(Math.round(avg30 * 10) / 10);

      // Heatmap (30 days)
      const hm = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        hm.set(dateStr, 0);
      }
      for (const l of logs) {
        const dateStr = l.review?.slice(0, 10);
        if (dateStr && hm.has(dateStr)) {
          hm.set(dateStr, (hm.get(dateStr) ?? 0) + 1);
        }
      }
      setHeatmap(hm);

      // Best day
      let bestD = { date: "", count: 0 };
      for (const [date, count] of hm) {
        if (count > bestD.count) bestD = { date, count };
      }
      setBestDay(bestD);

      // Streak
      const reviewDays = new Set(logs.map((l) => l.review?.slice(0, 10)));
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (reviewDays.has(d.toISOString().slice(0, 10))) s++;
        else if (i > 0) break;
      }
      setStreak(s);

      // Avg time per card (estimate from consecutive review timestamps)
      const sorted = [...logs].sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime());
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const gap = (new Date(sorted[i].review).getTime() - new Date(sorted[i - 1].review).getTime()) / 1000;
        if (gap > 0 && gap < 120) gaps.push(gap);
      }
      if (gaps.length > 0) {
        setAvgTimePerCard(Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10);
      }
    }
    load();
  }, []);

  const maxDaily = Math.max(...dailyData.map((d) => d.count), 1);
  const maxHeat = Math.max(...Array.from(heatmap.values()), 1);

  function exportCsv() {
    const header = "date,heure,note\n";
    const rows = [...rawLogs]
      .sort((a, b) => new Date(a.review).getTime() - new Date(b.review).getTime())
      .map((l) => {
        const d = new Date(l.review);
        return `${d.toISOString().slice(0, 10)},${d.toTimeString().slice(0, 8)},${RATING_LABELS[l.rating] ?? l.rating}`;
      });
    downloadBlob(header + rows.join("\n"), `fulfiency-stats-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }

  function exportPdf() {
    // Pas de lib PDF ajoutée pour une seule feature d'export : on s'appuie sur "imprimer en PDF"
    // du navigateur, guidé par la classe print-only ci-dessous.
    window.print();
  }

  const donutData = [
    { label: "À revoir", value: ratingDist.again, color: "var(--error)" },
    { label: "Difficile", value: ratingDist.hard, color: "var(--hard)" },
    { label: "Bien", value: ratingDist.good, color: "var(--sage)" },
    { label: "Facile", value: ratingDist.easy, color: "var(--gold)" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap print:hidden">
        <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold">
          Statistiques
        </h1>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={rawLogs.length === 0}
            className="text-xs py-2 px-4 rounded-lg border border-[rgba(201,165,82,0.4)] text-[var(--gold)]
              hover:bg-[rgba(201,165,82,0.1)] transition-all disabled:opacity-50"
          >
            Exporter CSV
          </button>
          <button
            onClick={exportPdf}
            className="text-xs py-2 px-4 rounded-lg border border-[rgba(201,165,82,0.4)] text-[var(--gold)]
              hover:bg-[rgba(201,165,82,0.1)] transition-all"
          >
            Exporter PDF
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: "Révisions", value: totalReviews, color: "var(--gold)" },
          { label: "Cartes", value: totalCards, color: "var(--slate)" },
          { label: "Nouvelles", value: newCards, color: "var(--slate)" },
          { label: "Matures", value: matureCards, color: "var(--sage)" },
          { label: "Streak", value: `${streak}j`, color: streak > 0 ? "var(--gold)" : "var(--slate)" },
          { label: "Moy/jour", value: avgPerDay, color: "var(--slate)" },
          { label: "Sec/carte", value: avgTimePerCard > 0 ? `${avgTimePerCard}s` : "—", color: "var(--slate)" },
        ].map((k) => (
          <Card key={k.label} className="text-center p-3 animate-kpi">
            <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[9px] text-[var(--slate)]">{k.label}</div>
          </Card>
        ))}
      </div>

      {bestDay.count > 0 && (
        <Card className="mb-6 p-4 text-center">
          <span className="text-xs text-[var(--slate)]">Meilleur jour : </span>
          <span className="text-sm font-bold text-[var(--gold)]">
            {new Date(bestDay.date).toLocaleDateString("fr", { day: "numeric", month: "long" })} — {bestDay.count} révisions
          </span>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {/* Bar chart - 7 days */}
        <Card>
          <h3 className="text-sm text-[var(--slate)] mb-4">Révisions (7 derniers jours)</h3>
          <div className="flex items-end gap-2 h-32">
            {dailyData.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[var(--gold)]">{d.count || ""}</span>
                <div
                  className="w-full rounded-t animate-bar-grow"
                  style={{
                    height: `${(d.count / maxDaily) * 100}%`,
                    minHeight: d.count > 0 ? "4px" : "0",
                    background: "linear-gradient(to top, var(--gold), var(--gold-light))",
                  }}
                />
                <span className="text-[10px] text-[var(--slate)]">
                  {new Date(d.date).toLocaleDateString("fr", { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Rating distribution */}
        <Card>
          <h3 className="text-sm text-[var(--slate)] mb-4">Répartition des notes</h3>
          {totalReviews === 0 ? (
            <p className="text-[var(--slate)] text-sm">Pas encore de données</p>
          ) : (
            <div className="space-y-3">
              {donutData.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-xs w-20" style={{ color: d.color }}>{d.label}</span>
                  <div className="flex-1 h-3 rounded-full bg-[var(--navy-mid)]">
                    <div
                      className="h-full rounded-full animate-bar-grow"
                      style={{
                        width: `${(d.value / totalReviews) * 100}%`,
                        background: d.color,
                      }}
                    />
                  </div>
                  <span className="text-xs text-[var(--slate)] w-10 text-right">
                    {Math.round((d.value / totalReviews) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Heatmap */}
        <Card className="sm:col-span-2">
          <h3 className="text-sm text-[var(--slate)] mb-4">Activité (30 jours)</h3>
          <div className="flex flex-wrap gap-1">
            {Array.from(heatmap.entries()).map(([date, count]) => (
              <div
                key={date}
                title={`${date}: ${count} révisions`}
                className="w-5 h-5 rounded-sm"
                style={{
                  background:
                    count === 0
                      ? "var(--navy-mid)"
                      : `rgba(201, 165, 82, ${0.2 + (count / maxHeat) * 0.8})`,
                }}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Graph view */}
      {graphCards.length > 0 && (
        <div className="mt-6">
          <h2 className="font-[family-name:var(--font-playfair-display)] text-xl font-bold mb-3">
            Vue graphe
          </h2>
          <p className="text-xs text-[var(--slate)] mb-3">
            Connexions entre decks, cartes et tags. Glisse les noeuds pour explorer.
          </p>
          <GraphView decks={graphDecks} cards={graphCards} />
        </div>
      )}
    </div>
  );
}
