"use client";

import { useEffect, useState } from "react";
import GoldButton from "@/components/ui/GoldButton";
import { useRouter } from "next/navigation";

interface SummaryProps {
  total: number;
  ratings: { again: number; hard: number; good: number; easy: number };
  startTime: number;
  cardTimes?: number[];
}

const CONFETTI_COLORS = ["#c9a552", "#eaa93d", "#73866d", "#f5f0e8", "#4a9eff", "#e8832a"];

export default function SessionSummary({ total, ratings, startTime, cardTimes = [] }: SummaryProps) {
  const router = useRouter();
  const [confetti, setConfetti] = useState<{ id: number; left: number; color: string; delay: number; size: number; duration: number; shape: string }[]>([]);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;

  const perfect = ratings.again === 0 && ratings.hard === 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        router.push("/dashboard");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    const pieces = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 1.2,
      size: Math.random() * 6 + 4,
      duration: 2 + Math.random() * 2,
      shape: Math.random() > 0.5 ? "50%" : "2px",
    }));
    setConfetti(pieces);
  }, []);

  const bars = [
    { label: "À revoir", count: ratings.again, color: "var(--error)" },
    { label: "Difficile", count: ratings.hard, color: "var(--hard)" },
    { label: "Bien", count: ratings.good, color: "var(--sage)" },
    { label: "Facile", count: ratings.easy, color: "var(--gold)" },
  ];

  return (
    <>
      {confetti.map((c) => (
        <div
          key={c.id}
          className="confetti-piece"
          style={{
            left: `${c.left}%`,
            background: c.color,
            width: `${c.size}px`,
            height: `${c.size}px`,
            borderRadius: c.shape,
            ["--fall-delay" as string]: `${c.delay}s`,
            ["--fall-duration" as string]: `${c.duration}s`,
          }}
        />
      ))}

      <div className={`card-hover p-8 max-w-md mx-auto animate-fade-slide text-center ${perfect ? "animate-glow" : ""}`}>
        <h2 className="font-[family-name:var(--font-playfair-display)] text-2xl font-bold mb-1">
          {perfect ? "✨ Session parfaite !" : "Session terminée"}
        </h2>
        {perfect && (
          <p className="text-[var(--gold)] text-sm mb-2 streak-fire">Pas une seule erreur !</p>
        )}
        <p className="text-[var(--slate)] mb-2">
          {total} carte{total > 1 ? "s" : ""} en {min > 0 ? `${min} min ` : ""}{sec}s
        </p>
        {cardTimes.length > 0 && (
          <p className="text-xs text-[var(--slate)] mb-6">
            Temps moyen : {(cardTimes.reduce((a, b) => a + b, 0) / cardTimes.length).toFixed(1)}s/carte
            {" · "}Plus rapide : {Math.min(...cardTimes).toFixed(1)}s
            {" · "}Plus lent : {Math.max(...cardTimes).toFixed(1)}s
          </p>
        )}

        <div className="space-y-3 mb-8">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-xs w-20 text-right" style={{ color: b.color }}>
                {b.label}
              </span>
              <div className="flex-1 h-3 rounded-full bg-[var(--navy-mid)]">
                <div
                  className="h-full rounded-full animate-bar-grow"
                  style={{
                    width: total > 0 ? `${(b.count / total) * 100}%` : "0%",
                    background: b.color,
                  }}
                />
              </div>
              <span className="text-xs w-6 text-[var(--slate)]">{b.count}</span>
            </div>
          ))}
        </div>

        <GoldButton onClick={() => router.push("/dashboard")} fullWidth>
          Retour aux decks
          <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20">Entrée</kbd>
        </GoldButton>
      </div>
    </>
  );
}
