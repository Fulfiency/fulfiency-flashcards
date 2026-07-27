"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { fsrs, Rating, type Card as FSRSCard, State } from "@/lib/fsrs";
import type { Grade } from "ts-fsrs";
import ReviewCard from "@/components/review/ReviewCard";
import RatingButtons from "@/components/review/RatingButtons";
import SessionSummary from "@/components/review/SessionSummary";
import ProgressBar from "@/components/ui/ProgressBar";
import { playFlip, playRating, playSuccess } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";
import { cacheDeckQueue, getCachedDeckQueue, queuePendingRating, getPendingRatings, clearPendingRatings } from "@/lib/offline";

interface DbCard {
  id: string;
  front: string;
  back: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  tags?: string[];
}

function formatInterval(d: Date): string {
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} j`;
}

export default function ReviewPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const [queue, setQueue] = useState<DbCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());
  const [ratings, setRatings] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [intervals, setIntervals] = useState({ again: "", hard: "", good: "", easy: "" });
  const [flipKey, setFlipKey] = useState(0);
  const [cardTimes, setCardTimes] = useState<number[]>([]);
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString();
      try {
        const { data } = await supabase
          .from("cards")
          .select("*")
          .eq("deck_id", deckId)
          .lte("due", now)
          .order("due");

        if (data) {
          cacheDeckQueue(deckId, data);
          if (data.length > 0) {
            setQueue(data);
            computeIntervals(data[0]);
          }
        }
      } catch {
        // hors-ligne ou requête échouée : retombe sur la dernière queue mise en cache pour ce deck
        const cached = getCachedDeckQueue<DbCard>(deckId);
        if (cached && cached.length > 0) {
          setQueue(cached);
          computeIntervals(cached[0]);
        }
      }
      setLoading(false);
    }
    load();
    flushPendingRatings();
    window.addEventListener("online", flushPendingRatings);
    return () => window.removeEventListener("online", flushPendingRatings);
  }, [deckId]);

  async function flushPendingRatings() {
    const pending = getPendingRatings();
    if (pending.length === 0) return;
    for (const p of pending) {
      await supabase.from("cards").update(p.update).eq("id", p.cardId);
      await supabase.from("review_logs").insert(p.reviewLog);
    }
    clearPendingRatings();
  }

  const computeIntervals = useCallback((card: DbCard) => {
    const fsrsCard: FSRSCard = {
      due: new Date(card.due),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as State,
      last_review: card.last_review ? new Date(card.last_review) : undefined,
    } as FSRSCard;

    const now = new Date();
    setIntervals({
      again: formatInterval(fsrs.next(fsrsCard, now, Rating.Again as Grade).card.due),
      hard: formatInterval(fsrs.next(fsrsCard, now, Rating.Hard as Grade).card.due),
      good: formatInterval(fsrs.next(fsrsCard, now, Rating.Good as Grade).card.due),
      easy: formatInterval(fsrs.next(fsrsCard, now, Rating.Easy as Grade).card.due),
    });
  }, []);

  async function handleRate(rating: number) {
    const card = queue[current];
    const fsrsCard: FSRSCard = {
      due: new Date(card.due),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as State,
      last_review: card.last_review ? new Date(card.last_review) : undefined,
    } as FSRSCard;

    const grade = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy][rating - 1] as Grade;
    const result = fsrs.next(fsrsCard, new Date(), grade);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const update = {
      due: result.card.due.toISOString(),
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsed_days: Math.floor(result.card.elapsed_days),
      scheduled_days: Math.floor(result.card.scheduled_days),
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: Number(result.card.state),
      last_review: new Date().toISOString(),
    };
    const reviewLog = {
      card_id: card.id,
      user_id: user.id,
      rating,
      review: new Date().toISOString(), // horodatage de la notation elle-même, pas de la synchro (utile hors-ligne)
      state: result.card.state,
      due: result.card.due.toISOString(),
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsed_days: result.card.elapsed_days,
      scheduled_days: result.card.scheduled_days,
    };

    if (!navigator.onLine) {
      queuePendingRating({ cardId: card.id, update, reviewLog });
    } else {
      try {
        const { error: updateError } = await supabase
          .from("cards")
          .update(update)
          .eq("id", card.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
        await supabase.from("review_logs").insert(reviewLog);
      } catch (e) {
        console.error("FSRS update failed, mise en file d'attente hors-ligne:", e);
        queuePendingRating({ cardId: card.id, update, reviewLog });
      }
    }

    if (getSettings().soundEnabled) playRating(rating);

    const ratingLabels = { 1: "again", 2: "hard", 3: "good", 4: "easy" } as const;
    setRatings((prev) => ({ ...prev, [ratingLabels[rating as keyof typeof ratingLabels]]: prev[ratingLabels[rating as keyof typeof ratingLabels]] + 1 }));

    const cardTime = (Date.now() - cardStartTime) / 1000;
    setCardTimes((prev) => [...prev, cardTime]);

    const next = current + 1;
    if (next >= queue.length) {
      setDone(true);
      if (getSettings().soundEnabled) setTimeout(playSuccess, 300);
    } else {
      setCurrent(next);
      setFlipped(false);
      setFlipKey((k) => k + 1);
      setCardStartTime(Date.now());
      computeIntervals(queue[next]);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (queue.length === 0 && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        router.push("/dashboard");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/dashboard");
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped && !done && queue.length > 0) {
          setFlipped(true);
          if (getSettings().soundEnabled) playFlip();
        }
      }
      if (flipped && !done && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        handleRate(parseInt(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, done, current, queue, router]);

  if (loading) return <div className="text-[var(--slate)] text-center py-12">Chargement...</div>;

  if (queue.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="font-[family-name:var(--font-playfair-display)] text-2xl font-bold mb-2">
          Aucune carte à réviser
        </h2>
        <p className="text-[var(--slate)]">Reviens plus tard !</p>
        <p className="text-xs text-[var(--slate)] mt-4">
          <kbd className="font-mono px-1.5 py-0.5 rounded bg-[var(--navy-mid)]">Entrée</kbd> ou{" "}
          <kbd className="font-mono px-1.5 py-0.5 rounded bg-[var(--navy-mid)]">Échap</kbd> pour retourner aux decks
        </p>
      </div>
    );
  }

  if (done) {
    return <SessionSummary total={queue.length} ratings={ratings} startTime={startTime} cardTimes={cardTimes} />;
  }

  const card = queue[current];

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--slate)]">
            {current + 1} / {queue.length}
          </span>
        </div>
        <ProgressBar value={current} max={queue.length} />
      </div>

      <ReviewCard
        key={flipKey}
        front={card.front}
        back={card.back}
        tags={card.tags}
        onFlip={(f) => { setFlipped(f); if (f && getSettings().soundEnabled) playFlip(); }}
      />

      {flipped && (
        <div className="animate-fade-slide">
          <RatingButtons intervals={intervals} onRate={handleRate} />
        </div>
      )}

      {!flipped && (
        <p className="text-center text-sm text-[var(--slate)] mt-6">
          Clique sur la carte pour révéler la réponse
        </p>
      )}
    </div>
  );
}
