"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import ReviewCard from "@/components/review/ReviewCard";
import ProgressBar from "@/components/ui/ProgressBar";
import GoldButton from "@/components/ui/GoldButton";
import { playFlip, playClick, playSuccess } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";

interface CramCard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
}

export default function CramPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [cards, setCards] = useState<CramCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [startTime] = useState(Date.now());
  const [flipKey, setFlipKey] = useState(0);
  const [knew, setKnew] = useState(0);
  const [didntKnow, setDidntKnow] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("cards")
        .select("id, front, back, tags")
        .eq("deck_id", deckId)
        .order("created_at");

      if (data && data.length > 0) {
        // Shuffle
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setCards(shuffled);
      }
      setLoading(false);
    }
    load();
  }, [deckId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped && !done) {
          setFlipped(true);
          if (getSettings().soundEnabled) playFlip();
        }
      }
      if (flipped && !done) {
        if (e.key === "1" || e.key === "ArrowLeft") { e.preventDefault(); rate(false); }
        if (e.key === "2" || e.key === "ArrowRight") { e.preventDefault(); rate(true); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, done, current]);

  function rate(known: boolean) {
    if (known) setKnew((k) => k + 1);
    else setDidntKnow((k) => k + 1);
    if (getSettings().soundEnabled) playClick();

    const next = current + 1;
    if (next >= cards.length) {
      setDone(true);
      if (getSettings().soundEnabled) setTimeout(playSuccess, 300);
    } else {
      setCurrent(next);
      setFlipped(false);
      setFlipKey((k) => k + 1);
    }
  }

  if (loading) return <div className="text-[var(--slate)] text-center py-12">Chargement...</div>;
  if (cards.length === 0) return <div className="text-center py-20"><h2 className="font-[family-name:var(--font-playfair-display)] text-2xl font-bold mb-2">Aucune carte</h2></div>;

  if (done) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    const pct = cards.length > 0 ? Math.round((knew / cards.length) * 100) : 0;

    return (
      <div className="card-hover p-8 max-w-md mx-auto animate-fade-slide text-center">
        <h2 className="font-[family-name:var(--font-playfair-display)] text-2xl font-bold mb-2">
          Session cram terminée
        </h2>
        <p className="text-[var(--slate)] mb-6">
          {cards.length} cartes en {min > 0 ? `${min} min ` : ""}{sec}s
        </p>
        <div className="flex justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--sage)]">{knew}</div>
            <div className="text-xs text-[var(--slate)]">Connues</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--error)]">{didntKnow}</div>
            <div className="text-xs text-[var(--slate)]">À revoir</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--gold)]">{pct}%</div>
            <div className="text-xs text-[var(--slate)]">Score</div>
          </div>
        </div>
        <GoldButton onClick={() => router.push("/dashboard")} fullWidth>Retour</GoldButton>
      </div>
    );
  }

  const card = cards[current];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--gold)] font-semibold uppercase tracking-wider">Mode Cram</span>
        <span className="text-sm text-[var(--slate)]">{current + 1} / {cards.length}</span>
      </div>
      <ProgressBar value={current} max={cards.length} />

      <div className="mt-6">
        <ReviewCard
          key={flipKey}
          front={card.front}
          back={card.back}
          tags={card.tags}
          onFlip={(f) => { setFlipped(f); if (f && getSettings().soundEnabled) playFlip(); }}
        />
      </div>

      {flipped && (
        <div className="flex gap-3 justify-center mt-6 animate-fade-slide">
          <button
            onClick={() => rate(false)}
            className="flex-1 max-w-[160px] py-3 rounded-lg font-semibold text-sm bg-[rgba(224,92,92,0.15)] border border-[rgba(224,92,92,0.3)] text-[var(--error)] hover:translate-y-[-2px] transition-all"
          >
            Je ne sais pas
            <div className="text-[10px] opacity-60 mt-0.5">1 ou ←</div>
          </button>
          <button
            onClick={() => rate(true)}
            className="flex-1 max-w-[160px] py-3 rounded-lg font-semibold text-sm bg-[rgba(115,134,109,0.15)] border border-[rgba(115,134,109,0.3)] text-[var(--sage)] hover:translate-y-[-2px] transition-all"
          >
            Je sais
            <div className="text-[10px] opacity-60 mt-0.5">2 ou →</div>
          </button>
        </div>
      )}

      {!flipped && (
        <p className="text-center text-sm text-[var(--slate)] mt-6">
          Clique ou appuie Espace pour révéler
        </p>
      )}
    </div>
  );
}
