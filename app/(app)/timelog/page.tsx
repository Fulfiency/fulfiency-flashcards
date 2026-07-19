"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";

type Energy = "good" | "mid" | "bad";

interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string;
  label: string;
  energy: Energy;
}

interface DayMetrics {
  stress: string;
  sommeil: string;
  energie: string;
}

const ENERGY_COLOR: Record<Energy, string> = {
  good: "var(--sage)",
  mid: "var(--hard)",
  bad: "var(--error)",
};

const ENERGY_EMOJI: Record<Energy, string> = { good: "🔥", mid: "😐", bad: "🪫" };

function toDateKey(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m}min`;
}

export default function TimeLogPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [metrics, setMetrics] = useState<DayMetrics>({ stress: "", sommeil: "", energie: "" });
  const [start, setStart] = useState(() => new Date().toTimeString().slice(0, 5));
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [energy, setEnergy] = useState<Energy>("mid");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const dateKey = toDateKey(date);

      const [{ data: entriesData }, { data: metricsData }] = await Promise.all([
        supabase
          .from("time_entries")
          .select("id, start_time, end_time, label, energy")
          .eq("user_id", user.id)
          .eq("entry_date", dateKey)
          .order("start_time"),
        supabase
          .from("day_metrics")
          .select("stress, sommeil, energie")
          .eq("user_id", user.id)
          .eq("entry_date", dateKey)
          .maybeSingle(),
      ]);

      setEntries((entriesData ?? []).map((e) => ({ ...e, energy: e.energy as Energy })));
      setMetrics(metricsData ?? { stress: "", sommeil: "", energie: "" });
      setLoading(false);
    }
    load();
  }, [date, supabase]);

  async function addEntry() {
    if (!start || !end || !label.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dateKey = toDateKey(date);
    const { data } = await supabase
      .from("time_entries")
      .insert({ user_id: user.id, entry_date: dateKey, start_time: start, end_time: end, label: label.trim(), energy })
      .select("id, start_time, end_time, label, energy")
      .single();
    if (data) {
      setEntries((prev) => [...prev, { ...data, energy: data.energy as Energy }].sort((a, b) => a.start_time.localeCompare(b.start_time)));
    }
    setStart(end);
    setEnd("");
    setLabel("");
  }

  async function deleteEntry(id: string) {
    await supabase.from("time_entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function saveMetrics(next: DayMetrics) {
    setMetrics(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("day_metrics").upsert({
      user_id: user.id,
      entry_date: toDateKey(date),
      ...next,
    });
  }

  function shiftDay(delta: number) {
    setDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }

  const counts = { good: 0, mid: 0, bad: 0 };
  entries.forEach((e) => counts[e.energy]++);
  const total = entries.length;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold mb-6">
        Time Log
      </h1>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDay(-1)}
            className="w-7 h-7 rounded-lg border border-[var(--navy-mid)] text-[var(--slate)] hover:text-[var(--white)] transition-colors"
          >
            ‹
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center">
            {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
          </span>
          <button
            onClick={() => shiftDay(1)}
            className="w-7 h-7 rounded-lg border border-[var(--navy-mid)] text-[var(--slate)] hover:text-[var(--white)] transition-colors"
          >
            ›
          </button>
        </div>
        <button
          onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDate(d); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--navy-mid)] text-[var(--slate)] hover:text-[var(--white)] transition-colors"
        >
          Aujourd&apos;hui
        </button>
      </div>

      <Card className="mb-6">
        <div className="flex gap-2 mb-2">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-transparent border border-[var(--navy-mid)] rounded-lg px-2 py-2 text-sm w-[100px]"
          />
          <span className="self-center text-[var(--slate)] text-sm">→</span>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-transparent border border-[var(--navy-mid)] rounded-lg px-2 py-2 text-sm w-[100px]"
          />
          <select
            value={energy}
            onChange={(e) => setEnergy(e.target.value as Energy)}
            className="bg-transparent border border-[var(--navy-mid)] rounded-lg px-2 py-2 text-sm"
          >
            <option value="mid">😐</option>
            <option value="good">🔥</option>
            <option value="bad">🪫</option>
          </select>
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addEntry()}
          placeholder="Ce que tu as fait..."
          className="w-full bg-transparent border border-[var(--navy-mid)] rounded-lg px-3 py-2 text-sm mb-2"
        />
        <button
          onClick={addEntry}
          className="w-full py-2 rounded-lg text-sm font-semibold text-[var(--navy)] bg-[var(--gold)] hover:bg-[var(--gold-light)] transition-colors"
        >
          Ajouter
        </button>
      </Card>

      <div className="space-y-2 mb-6">
        {loading ? (
          <p className="text-sm text-[var(--slate)] text-center py-6">Chargement...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[var(--slate)] text-center py-6">Aucune entrée pour ce jour.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-stretch gap-3">
              <div className="flex-none w-[52px] flex flex-col items-center text-[11px] text-[var(--slate)]">
                <span>{e.start_time.slice(0, 5)}</span>
                <span className="flex-1 w-[2px] my-1" style={{ background: ENERGY_COLOR[e.energy], minHeight: 12 }} />
                <span>{e.end_time.slice(0, 5)}</span>
              </div>
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-[var(--navy-mid)] px-3 py-2">
                <span className="flex-1 text-sm">{e.label}</span>
                <span className="text-xs text-[var(--slate)]">{durationLabel(e.start_time, e.end_time)}</span>
                <button
                  onClick={() => deleteEntry(e.id)}
                  className="text-[var(--slate)] hover:text-[var(--error)] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Card>
        <h3 className="text-sm font-semibold mb-3">Bilan du jour</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {([
            { key: "stress", label: "Stress", placeholder: "modéré, 32%..." },
            { key: "sommeil", label: "Sommeil", placeholder: "7h30, profond..." },
            { key: "energie", label: "Énergie", placeholder: "83%, réveillé..." },
          ] as const).map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] text-[var(--slate)] mb-1">{f.label}</label>
              <input
                type="text"
                value={metrics[f.key]}
                onChange={(e) => saveMetrics({ ...metrics, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-transparent border border-[var(--navy-mid)] rounded-lg px-2 py-1.5 text-xs"
              />
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="text-xs text-[var(--slate)]">
            <b className="text-[var(--white)]">{total}</b> entrées — {ENERGY_EMOJI.good} {counts.good} · {ENERGY_EMOJI.mid} {counts.mid} · {ENERGY_EMOJI.bad} {counts.bad}
            <div className="h-2 rounded-full overflow-hidden flex mt-2 bg-[var(--navy-mid)]">
              <div style={{ width: `${(counts.good / total) * 100}%`, background: ENERGY_COLOR.good }} />
              <div style={{ width: `${(counts.mid / total) * 100}%`, background: ENERGY_COLOR.mid }} />
              <div style={{ width: `${(counts.bad / total) * 100}%`, background: ENERGY_COLOR.bad }} />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
