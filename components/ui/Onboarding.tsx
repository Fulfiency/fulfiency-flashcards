"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import GoldButton from "@/components/ui/GoldButton";
import { useRouter } from "next/navigation";
import { playSuccess } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";

const EXAMPLE_CARDS = [
  { front: "What does 'to lay low' mean?", back: "Se faire discret, faire profil bas" },
  { front: "What is spaced repetition?", back: "Technique de mémorisation qui espace les révisions selon la difficulté" },
  { front: "FSRS stands for?", back: "Free Spaced Repetition Scheduler — algorithme de planification des révisions" },
];

export default function Onboarding() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const seen = localStorage.getItem("fulfiency-onboarding-done");
    if (!seen) setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem("fulfiency-onboarding-done", "1");
    setShow(false);
  }

  async function createExample() {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { data: deck } = await supabase
      .from("decks")
      .insert({ name: "Bienvenue 👋", description: "Deck exemple pour découvrir Fulfiency", color: "#c9a552", user_id: user.id })
      .select("id")
      .single();

    if (deck) {
      await supabase.from("cards").insert(
        EXAMPLE_CARDS.map((c) => ({ deck_id: deck.id, user_id: user.id, front: c.front, back: c.back }))
      );
    }

    if (getSettings().soundEnabled) playSuccess();
    dismiss();
    router.refresh();
  }

  if (!show) return null;

  const steps = [
    {
      title: "Bienvenue sur Fulfiency Flashcards",
      content: "Mémorise efficacement grâce à la répétition espacée FSRS-5. Crée des decks, ajoute des cartes, et révise chaque jour.",
    },
    {
      title: "Comment ça marche ?",
      content: "1. Crée un deck et ajoute des cartes (recto/verso)\n2. Révise — note chaque carte (À revoir → Facile)\n3. L'algorithme planifie les prochaines révisions automatiquement\n4. Plus tu révises, mieux tu retiens",
    },
    {
      title: "Raccourcis essentiels",
      content: "Ctrl+K → Recherche globale\nCtrl+N → Carte rapide\nCtrl+R → Révision rapide\nEspace → Retourner la carte\n1-4 → Noter la carte",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 bg-[var(--navy-light)] border border-[rgba(201,165,82,0.2)] rounded-xl shadow-2xl overflow-hidden animate-fade-slide">
        <div className="p-6">
          <h2 className="font-[family-name:var(--font-playfair-display)] text-xl font-bold mb-3 text-shimmer">
            {steps[step].title}
          </h2>
          <div className="text-sm text-[var(--slate)] whitespace-pre-line mb-6">
            {steps[step].content}
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-2 mb-4">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? "bg-[var(--gold)]" : "bg-[var(--navy-mid)]"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step < steps.length - 1 ? (
              <>
                <button onClick={dismiss} className="flex-1 py-2 text-sm text-[var(--slate)] hover:text-[var(--white)] transition-colors">
                  Passer
                </button>
                <GoldButton onClick={() => setStep(step + 1)} className="flex-1 text-sm py-2">
                  Suivant
                </GoldButton>
              </>
            ) : (
              <>
                <button onClick={dismiss} className="flex-1 py-2 text-sm text-[var(--slate)] hover:text-[var(--white)] transition-colors rounded-lg border border-[var(--navy-mid)]">
                  Commencer vide
                </button>
                <GoldButton onClick={createExample} disabled={creating} className="flex-1 text-sm py-2">
                  {creating ? "..." : "Créer deck exemple"}
                </GoldButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
