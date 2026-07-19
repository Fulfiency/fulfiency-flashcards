"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import GoldButton from "@/components/ui/GoldButton";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { playAdd } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";

interface DeckOption {
  id: string;
  name: string;
}

export default function QuickAddCard() {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [deckId, setDeckId] = useState("");
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    async function loadDecks() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("decks").select("id, name").eq("user_id", user.id).order("name");
      if (data) {
        setDecks(data);
        if (data.length > 0 && !deckId) setDeckId(data[0].id);
      }
    }
    loadDecks();
    setFront("");
    setBack("");
  }, [open]);

  async function save() {
    if (!front.trim() || !back.trim() || !deckId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("cards").insert({
      deck_id: deckId,
      user_id: user.id,
      front: front.trim(),
      back: back.trim(),
    });

    if (getSettings().soundEnabled) playAdd();
    setSaving(false);
    setFront("");
    setBack("");
  }

  async function saveAndClose() {
    await save();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg mx-4 bg-[var(--navy-light)] border border-[rgba(201,165,82,0.2)] rounded-xl shadow-2xl overflow-hidden animate-fade-slide">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--navy-mid)]">
          <h2 className="font-[family-name:var(--font-playfair-display)] font-bold">Carte rapide</h2>
          <div className="flex items-center gap-2">
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="bg-[var(--navy)] border border-[var(--navy-mid)] rounded px-2 py-1 text-xs text-[var(--white)] outline-none"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--navy)] text-[var(--slate)] text-[10px] font-mono">Esc</kbd>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] text-[var(--gold)] mb-1 block uppercase tracking-wider font-semibold">Recto</label>
            <RichTextEditor value={front} onChange={setFront} placeholder="Question..." autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Verso</label>
            <RichTextEditor value={back} onChange={setBack} placeholder="Réponse..." />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--navy-mid)] flex items-center justify-between">
          <button
            onClick={save}
            disabled={saving || !front.trim() || !back.trim()}
            className="text-xs text-[var(--gold)] hover:underline disabled:opacity-50"
          >
            Ajouter + continuer
          </button>
          <GoldButton onClick={saveAndClose} disabled={saving || !front.trim() || !back.trim()} className="text-xs py-2 px-4">
            {saving ? "..." : "Ajouter et fermer"}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
