"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import GoldButton from "@/components/ui/GoldButton";
import Card from "@/components/ui/Card";
import RichTextEditor from "@/components/ui/RichTextEditor";
import TagInput from "@/components/ui/TagInput";
import Modal from "@/components/ui/Modal";
import { playAdd, playDelete, playSuccess, playError } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";

interface CardDraft {
  id: number;
  front: string;
  back: string;
  tags: string[];
}

const COLORS = ["#c9a552", "#73866d", "#e8832a", "#e05c5c", "#a7bcb7", "#4a9eff"];

export default function CreatePage() {
  // Compteur d'ids par instance (pas module-level) : un `let` partagé au niveau module se faisait
  // incrémenter côté serveur ET côté client (et deux fois en double-render StrictMode), ce qui
  // désynchronisait l'id de la première carte entre le HTML SSR et l'hydratation client.
  const nextIdRef = useRef(1);
  const genId = () => nextIdRef.current++;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#c9a552");
  const [cards, setCards] = useState<CardDraft[]>(() => [{ id: 0, front: "", back: "", tags: [] }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(true);
  const [existingDecks, setExistingDecks] = useState<{ id: string; name: string }[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [allDeckNames, setAllDeckNames] = useState<string[]>([]);
  const [allExistingTags, setAllExistingTags] = useState<string[]>([]);
  const [showDeckSuggestions, setShowDeckSuggestions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genWarning, setGenWarning] = useState("");
  const [genPhase, setGenPhase] = useState("");
  const [showGenModal, setShowGenModal] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genFile, setGenFile] = useState<File | null>(null);
  const [lastGenIds, setLastGenIds] = useState<number[] | null>(null);
  const [lastGenSnapshot, setLastGenSnapshot] = useState<{ id: number; front: string; back: string }[] | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [genUsage, setGenUsage] = useState<{ used: number; limit: number | null } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const snd = () => getSettings().soundEnabled;
  const validCount = cards.filter((c) => c.front.trim() && c.back.trim()).length;

  useEffect(() => {
    async function loadSuggestions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: decks }, { data: cardData }] = await Promise.all([
        supabase.from("decks").select("name").eq("user_id", user.id),
        supabase.from("cards").select("tags").eq("user_id", user.id),
      ]);
      if (decks) setAllDeckNames(decks.map((d) => d.name));
      if (cardData) {
        const tags = new Set<string>();
        for (const c of cardData) {
          for (const t of (c.tags ?? [])) tags.add(t);
        }
        setAllExistingTags([...tags]);
      }
    }
    loadSuggestions();
    refreshUsage();
  }, []);

  async function refreshUsage() {
    try {
      const res = await fetch("/api/generate-cards");
      if (!res.ok) return;
      const data = await res.json();
      setGenUsage({ used: data.used, limit: data.limit });
    } catch {
      // silencieux : l'affichage du quota est secondaire
    }
  }

  function updateCard(id: number, field: "front" | "back", val: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
  }

  function updateCardTags(id: number, tags: string[]) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, tags } : c)));
  }

  const allTags = [...new Set([...allExistingTags, ...cards.flatMap((c) => c.tags)])];

  function addCard() {
    const newCard = { id: genId(), front: "", back: "", tags: [] };
    setCards((prev) => [...prev, newCard]);
    if (snd()) playAdd();
    setTimeout(() => {
      document.getElementById(`card-${newCard.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function removeCard(id: number) {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (snd()) playDelete();
  }

  function duplicateCard(id: number) {
    const src = cards.find((c) => c.id === id);
    if (!src) return;
    const copy = { id: genId(), front: src.front, back: src.back, tags: [...src.tags] };
    const idx = cards.findIndex((c) => c.id === id);
    setCards((prev) => [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]);
    if (snd()) playAdd();
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Donne un nom au deck");
      setShowSetup(true);
      nameRef.current?.focus();
      if (snd()) playError();
      return;
    }
    const validCards = cards.filter((c) => c.front.trim() && c.back.trim());
    if (validCards.length === 0) {
      setError("Ajoute au moins une carte complète");
      if (snd()) playError();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check for existing decks with same name
    const { data: dupes } = await supabase
      .from("decks")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", name.trim());

    if (dupes && dupes.length > 0) {
      setExistingDecks(dupes);
      setShowDuplicateModal(true);
      return;
    }

    await saveToNewDeck(user.id);
  }

  async function saveToNewDeck(userId: string) {
    setSaving(true);
    setError("");

    const { data: deck, error: deckErr } = await supabase
      .from("decks")
      .insert({ name: name.trim(), description: description.trim() || null, color, user_id: userId })
      .select("id")
      .single();

    if (deckErr || !deck) { setError(deckErr?.message ?? "Erreur"); setSaving(false); return; }
    await saveCardsToDeck(deck.id, userId);
  }

  async function saveToExistingDeck(deckId: string) {
    setShowDuplicateModal(false);
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await saveCardsToDeck(deckId, user.id);
  }

  async function saveCardsToDeck(deckId: string, userId: string) {
    const validCards = cards.filter((c) => c.front.trim() && c.back.trim());

    const cardRowsWithTags = validCards.map((c) => ({
      deck_id: deckId,
      user_id: userId,
      front: c.front.trim(),
      back: c.back.trim(),
      tags: c.tags,
    }));

    let { error: cardErr } = await supabase.from("cards").insert(cardRowsWithTags);
    if (cardErr?.message?.includes("tags")) {
      const cardRowsNoTags = validCards.map((c) => ({
        deck_id: deckId,
        user_id: userId,
        front: c.front.trim(),
        back: c.back.trim(),
      }));
      ({ error: cardErr } = await supabase.from("cards").insert(cardRowsNoTags));
    }
    if (cardErr) { setError(cardErr.message); setSaving(false); return; }

    if (snd()) playSuccess();
    router.push("/dashboard");
  }

  function handlePdfSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setGenError("Le fichier dépasse 8 Mo, choisis un PDF plus léger.");
      return;
    }
    setGenFile(file);
    setGenError("");
    setLastGenIds(null);
    setShowGenModal(true);
  }

  async function runGeneration(replaceIds?: number[]) {
    if (!genFile) return;
    setGenerating(true);
    setGenError("");
    setGenWarning("");
    setGenPhase("Lecture du PDF...");
    const phaseTimer = setTimeout(() => setGenPhase("Génération des cartes par l'IA..."), 1200);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const excludedIds = new Set(replaceIds ?? []);
      const existingFronts = cards
        .filter((c) => !excludedIds.has(c.id))
        .map((c) => c.front.trim())
        .filter(Boolean);
      const body = new FormData();
      body.append("file", genFile);
      body.append("count", String(genCount));
      body.append("existingFronts", JSON.stringify(existingFronts));
      const res = await fetch("/api/generate-cards", { method: "POST", body, signal: controller.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur de génération");
      }

      let firstBase: { base: CardDraft[]; onlyEmpty: boolean } | null = null;
      const generated: { id: number; front: string; back: string }[] = [];
      let sawError: string | null = null;
      let truncated = false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const evt = JSON.parse(chunk.slice(6));
          if (evt.type === "phase") {
            setGenPhase("Génération des cartes par l'IA...");
          } else if (evt.type === "card") {
            const newCard: CardDraft = { id: genId(), front: evt.front, back: evt.back, tags: [] };
            generated.push({ id: newCard.id, front: newCard.front, back: newCard.back });
            setCards((prev) => {
              if (!firstBase) {
                const base = replaceIds ? prev.filter((c) => !excludedIds.has(c.id)) : prev;
                const onlyEmpty = base.length === 1 && !base[0].front.trim() && !base[0].back.trim();
                firstBase = { base, onlyEmpty };
                return onlyEmpty ? [newCard] : [...base, newCard];
              }
              return [...prev, newCard];
            });
          } else if (evt.type === "error") {
            sawError = evt.error;
          } else if (evt.type === "done") {
            truncated = !!evt.truncated;
          }
        }
      }

      if (sawError) throw new Error(sawError);
      if (generated.length === 0) throw new Error("Aucune carte générée");

      setLastGenIds(generated.map((c) => c.id));
      setLastGenSnapshot(generated);
      if (truncated) {
        setGenWarning("Le PDF est long : seul le début du document a été utilisé pour générer les cartes.");
      }
      setShowGenModal(false);
      if (snd()) playSuccess();
      refreshUsage();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setGenError("Génération annulée.");
      } else {
        setGenError(err instanceof Error ? err.message : "Erreur de génération");
        if (snd()) playError();
      }
    } finally {
      clearTimeout(phaseTimer);
      abortControllerRef.current = null;
      setGenerating(false);
      setGenPhase("");
    }
  }

  function cancelGeneration() {
    abortControllerRef.current?.abort();
  }

  function regenerateLast() {
    if (!lastGenIds || !genFile) return;
    const edited = lastGenSnapshot?.some((snap) => {
      const current = cards.find((c) => c.id === snap.id);
      return current && (current.front !== snap.front || current.back !== snap.back);
    });
    if (edited) {
      setShowRegenConfirm(true);
      return;
    }
    setGenWarning("");
    runGeneration(lastGenIds);
  }

  function confirmRegenerate() {
    setShowRegenConfirm(false);
    setGenWarning("");
    runGeneration(lastGenIds ?? undefined);
  }

  function handleGlobalKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n") {
      e.preventDefault();
      addCard();
    }
  }

  return (
    <div onKeyDown={handleGlobalKeyDown}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-[family-name:var(--font-playfair-display)] text-2xl font-bold">
          Créer un deck
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--slate)]">
            {validCount} carte{validCount > 1 ? "s" : ""} prête{validCount > 1 ? "s" : ""}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfSelected}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={generating || (genUsage?.limit != null && genUsage.used >= genUsage.limit)}
            title={genUsage ? (genUsage.limit == null ? "Générations illimitées" : `${genUsage.used}/${genUsage.limit} générations utilisées ce mois-ci`) : undefined}
            className="text-xs py-2 px-4 rounded-lg border border-[rgba(201,165,82,0.4)] text-[var(--gold)]
              hover:bg-[rgba(201,165,82,0.1)] transition-all disabled:opacity-50"
          >
            {generating ? "Génération..." : "Générer depuis un PDF"}
            {genUsage && (
              <span className="ml-1.5 text-[10px] text-[var(--slate)]">
                ({genUsage.limit == null ? "illimité" : `${genUsage.used}/${genUsage.limit}`})
              </span>
            )}
          </button>
          <GoldButton onClick={handleSave} disabled={saving} className="text-xs py-2 px-5">
            {saving ? "..." : "Sauvegarder"}
          </GoldButton>
        </div>
      </div>

      {genError && !showGenModal && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-[var(--error)]15 border border-[var(--error)] text-[var(--error)] text-sm">
          {genError}
        </div>
      )}

      {genWarning && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-[var(--gold)]15 border border-[rgba(201,165,82,0.4)] text-[var(--gold)] text-sm">
          {genWarning}
        </div>
      )}

      {lastGenIds && !showGenModal && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-[var(--navy)] border border-[var(--navy-mid)] flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--slate)]">
            {lastGenIds.length} carte{lastGenIds.length > 1 ? "s" : ""} générée{lastGenIds.length > 1 ? "s" : ""} depuis {genFile?.name}. Pas convaincu ?
          </span>
          <button
            onClick={regenerateLast}
            disabled={generating}
            className="text-xs py-1.5 px-3 rounded-lg border border-[rgba(201,165,82,0.4)] text-[var(--gold)]
              hover:bg-[rgba(201,165,82,0.1)] transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {generating ? genPhase || "..." : "Régénérer"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-[var(--error)]15 border border-[var(--error)] text-[var(--error)] text-sm">
          {error}
        </div>
      )}

      {/* Deck setup - collapsible */}
      <div className="mb-6">
        <button
          onClick={() => setShowSetup(!showSetup)}
          className="flex items-center gap-2 text-sm text-[var(--slate)] hover:text-[var(--white)] transition-colors mb-2"
        >
          <span className={`transition-transform ${showSetup ? "rotate-90" : ""}`}>▶</span>
          Infos du deck
          {name && <span className="text-[var(--gold)] text-xs">— {name}</span>}
        </button>

        {showSetup && (
          <Card className="animate-fade-slide">
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <div>
                <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Nom</label>
                <div className="relative">
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => { setName(e.target.value); setShowDeckSuggestions(true); }}
                    onFocus={() => setShowDeckSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowDeckSuggestions(false), 150)}
                    placeholder="ex: Vocabulaire anglais B2"
                    className="w-full px-3 py-2.5 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
                  />
                  {showDeckSuggestions && name.trim() && (() => {
                    const suggestions = allDeckNames.filter((n) =>
                      n.toLowerCase().includes(name.toLowerCase()) && n.toLowerCase() !== name.toLowerCase()
                    ).slice(0, 5);
                    if (suggestions.length === 0) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg z-50 shadow-xl py-1">
                        {suggestions.map((s) => (
                          <button
                            key={s}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setName(s); setShowDeckSuggestions(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[rgba(201,165,82,0.1)] transition-colors text-[var(--white)]"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2.5 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
                />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      background: c,
                      borderColor: color === c ? "var(--white)" : "transparent",
                      transform: color === c ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {cards.map((c, i) => (
          <div
            key={c.id}
            id={`card-${c.id}`}
            className="card-hover p-4 animate-card-entrance"
          >
            {/* Card header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--slate)] bg-[var(--navy)] px-1.5 py-0.5 rounded">
                  {i + 1}
                </span>
                {c.front.trim() && c.back.trim() ? (
                  <span className="text-[10px] text-[var(--sage)]">✓ complète</span>
                ) : (
                  <span className="text-[10px] text-[var(--slate)]">brouillon</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicateCard(c.id)}
                  title="Dupliquer"
                  className="px-2 py-1 text-[10px] text-[var(--slate)] hover:text-[var(--gold)] rounded hover:bg-[rgba(201,165,82,0.1)] transition-all"
                >
                  Dupliquer
                </button>
                {cards.length > 1 && (
                  <button
                    onClick={() => removeCard(c.id)}
                    title="Supprimer"
                    className="px-2 py-1 text-[10px] text-[var(--error)] rounded hover:bg-[rgba(224,92,92,0.1)] transition-all"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>

            {/* Front / Back side by side */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[var(--gold)] mb-1 block uppercase tracking-wider font-semibold">
                  Recto
                </label>
                <RichTextEditor
                  value={c.front}
                  onChange={(v) => updateCard(c.id, "front", v)}
                  placeholder="Question, mot, concept..."
                  autoFocus={i === cards.length - 1 && cards.length > 1}
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">
                  Verso
                </label>
                <RichTextEditor
                  value={c.back}
                  onChange={(v) => updateCard(c.id, "back", v)}
                  placeholder="Réponse, définition, traduction..."
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Tags</label>
                <TagInput
                  tags={c.tags}
                  onChange={(t) => updateCardTags(c.id, t)}
                  allTags={allTags}
                  placeholder="verbe, grammaire, B2..."
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add card button */}
        <button
          onClick={addCard}
          className="w-full py-4 rounded-xl border-2 border-dashed border-[rgba(201,165,82,0.25)] text-[var(--gold)] text-sm font-medium
            hover:bg-[rgba(201,165,82,0.05)] hover:border-[rgba(201,165,82,0.5)] transition-all flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> Ajouter une carte
          <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--navy-light)] text-[var(--slate)]">Ctrl+Shift+N</kbd>
        </button>
      </div>

      {/* Sticky bottom save bar */}
      <div className="sticky bottom-16 sm:bottom-4 mt-6 z-30">
        <div className="bg-[var(--navy)]/95 backdrop-blur-md rounded-xl border border-[rgba(201,165,82,0.15)] p-3 flex items-center justify-between">
          <div className="text-xs text-[var(--slate)]">
            {validCount}/{cards.length} cartes complètes
            <kbd className="ml-2 font-mono px-1.5 py-0.5 rounded bg-[var(--navy-light)] text-[var(--gold)]">Ctrl+Enter</kbd>
          </div>
          <GoldButton onClick={handleSave} disabled={saving} className="text-xs py-2 px-6">
            {saving ? "Sauvegarde..." : "Créer le deck"}
          </GoldButton>
        </div>
      </div>

      {/* PDF generation modal */}
      <Modal
        open={showGenModal}
        onClose={() => { if (!generating) setShowGenModal(false); }}
        title="Générer des cartes depuis ce PDF"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--slate)]">
            {genFile?.name}
          </p>
          {genUsage && (
            <p className="text-xs text-[var(--slate)]">
              {genUsage.limit == null
                ? "Générations illimitées"
                : `${genUsage.used}/${genUsage.limit} générations utilisées ce mois-ci`}
            </p>
          )}
          <div>
            <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">
              Nombre de cartes
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={genCount}
              onChange={(e) => setGenCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm"
            />
          </div>
          {genError && (
            <div className="px-4 py-2 rounded-lg bg-[var(--error)]15 border border-[var(--error)] text-[var(--error)] text-sm">
              {genError}
            </div>
          )}
          <div className="flex gap-2">
            <GoldButton onClick={() => runGeneration()} disabled={generating} fullWidth>
              {generating ? genPhase || "Génération en cours..." : "Générer"}
            </GoldButton>
            {generating && (
              <button
                onClick={cancelGeneration}
                className="text-xs py-2 px-4 rounded-lg border border-[rgba(224,92,92,0.4)] text-[var(--error)]
                  hover:bg-[rgba(224,92,92,0.1)] transition-all whitespace-nowrap"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Regenerate confirmation modal */}
      <Modal open={showRegenConfirm} onClose={() => setShowRegenConfirm(false)} title="Régénérer le dernier lot ?">
        <div className="space-y-3">
          <p className="text-sm text-[var(--slate)]">
            Certaines cartes du dernier lot ont été modifiées. Régénérer les remplacera quand même par un nouveau lot.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRegenConfirm(false)}
              className="flex-1 text-xs py-2.5 px-4 rounded-lg border border-[var(--navy-mid)] text-[var(--slate)]
                hover:bg-[rgba(255,255,255,0.05)] transition-all"
            >
              Annuler
            </button>
            <GoldButton onClick={confirmRegenerate} className="flex-1 text-xs py-2.5">
              Régénérer quand même
            </GoldButton>
          </div>
        </div>
      </Modal>

      {/* Duplicate deck modal */}
      <Modal open={showDuplicateModal} onClose={() => setShowDuplicateModal(false)} title="Deck existant">
        <div className="space-y-3">
          <p className="text-sm text-[var(--slate)]">
            Un deck avec un nom similaire existe déjà. Tu veux ajouter les cartes à un deck existant ou en créer un nouveau ?
          </p>
          <div className="space-y-2">
            {existingDecks.map((d) => (
              <button
                key={d.id}
                onClick={() => saveToExistingDeck(d.id)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--navy)] border border-[var(--navy-mid)] text-left hover:border-[var(--gold)] transition-colors"
              >
                <span className="text-sm font-medium">{d.name}</span>
                <span className="text-xs text-[var(--slate)] ml-2">← ajouter ici</span>
              </button>
            ))}
          </div>
          <GoldButton
            onClick={async () => {
              setShowDuplicateModal(false);
              const { data: { user } } = await supabase.auth.getUser();
              if (user) saveToNewDeck(user.id);
            }}
            fullWidth
          >
            Créer un nouveau deck quand même
          </GoldButton>
        </div>
      </Modal>
    </div>
  );
}
