"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import GoldButton from "@/components/ui/GoldButton";
import Modal from "@/components/ui/Modal";
import RichTextEditor from "@/components/ui/RichTextEditor";
import TagInput from "@/components/ui/TagInput";
import { playAdd, playDelete, playClick } from "@/lib/sounds";
import { getSettings } from "@/lib/settings";
import { exportApkg, importApkg } from "@/lib/anki";

interface CardRow {
  id: string;
  front: string;
  back: string;
  state: number;
  due: string;
  tags: string[];
}

interface DeckRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [deck, setDeck] = useState<DeckRow | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editCard, setEditCard] = useState<CardRow | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [subDecks, setSubDecks] = useState<{ id: string; name: string; color: string }[]>([]);
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [subName, setSubName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function s() { return getSettings().soundEnabled; }

  async function load() {
    const { data: d } = await supabase.from("decks").select("*").eq("id", id).single();
    const { data: c } = await supabase
      .from("cards")
      .select("*")
      .eq("deck_id", id)
      .order("created_at");
    setDeck(d);
    setCards((c ?? []).map((card: any) => ({ ...card, tags: card.tags ?? [] })));
    setLoading(false);
    setSelected(new Set());

    // Load sub-decks
    const { data: subs } = await supabase
      .from("decks")
      .select("id, name, color")
      .eq("parent_id", id)
      .order("name");
    setSubDecks(subs ?? []);
  }

  useEffect(() => { load(); }, [id]);

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("cards").insert({
      deck_id: id,
      user_id: user.id,
      front: front.trim(),
      back: back.trim(),
    });
    setFront("");
    setBack("");
    setAddOpen(false);
    if (s()) playAdd();
    load();
  }

  function openEdit(card: CardRow) {
    setEditCard(card);
    setFront(card.front);
    setBack(card.back);
    setEditTags(card.tags ?? []);
  }

  async function saveEdit() {
    if (!editCard || !front.trim() || !back.trim()) return;
    const { error: updateErr } = await supabase.from("cards").update({ front: front.trim(), back: back.trim(), tags: editTags }).eq("id", editCard.id);
    if (updateErr?.message?.includes("tags")) {
      await supabase.from("cards").update({ front: front.trim(), back: back.trim() }).eq("id", editCard.id);
    }
    setEditCard(null);
    setFront("");
    setBack("");
    setEditTags([]);
    if (s()) playClick();
    load();
  }

  const allTags = [...new Set(cards.flatMap((c) => c.tags ?? []))];

  function toggleSelect(cardId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.from("cards").delete().in("id", ids);
    if (s()) playDelete();
    load();
  }

  async function resetSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const now = new Date().toISOString();
    await supabase
      .from("cards")
      .update({
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      })
      .in("id", ids);
    await supabase.from("review_logs").delete().in("card_id", ids);
    if (s()) playClick();
    load();
  }

  async function resetAll() {
    const now = new Date().toISOString();
    await supabase
      .from("cards")
      .update({
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      })
      .eq("deck_id", id);
    await supabase.from("review_logs").delete().in("card_id", cards.map((c) => c.id));
    if (s()) playClick();
    load();
  }

  async function createSubDeck() {
    if (!subName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("decks").insert({
      name: subName.trim(),
      user_id: user.id,
      parent_id: id,
      color: deck?.color ?? "#c9a552",
    });
    setSubName("");
    setShowCreateSub(false);
    if (s()) playClick();
    load();
  }

  async function deleteDeck() {
    await supabase.from("decks").delete().eq("id", id);
    router.push("/dashboard");
  }

  const [importing, setImporting] = useState(false);

  async function exportDeck() {
    if (!deck) return;
    const blob = await exportApkg(deck.name, cards.map((c) => ({ front: c.front, back: c.back, tags: c.tags })));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.name}.apkg`;
    a.click();
    URL.revokeObjectURL(url);
    if (s()) playClick();
  }

  async function importFromApkg(file: File) {
    setImporting(true);
    try {
      const decksFound = await importApkg(file);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const allCards = decksFound.flatMap((d) => d.cards);
      if (allCards.length === 0) {
        alert("Aucune carte trouvée dans ce fichier .apkg");
        return;
      }
      await supabase.from("cards").insert(
        allCards.map((c) => ({
          deck_id: id,
          user_id: user.id,
          front: c.front,
          back: c.back,
          tags: c.tags ?? [],
        }))
      );
      if (s()) playAdd();
      load();
    } catch (e) {
      alert(`Import échoué : ${e instanceof Error ? e.message : e}`);
    } finally {
      setImporting(false);
    }
  }

  const stateLabels = ["Nouvelle", "Apprentissage", "Révision", "Réapprentissage"];
  const stateColors = ["var(--slate)", "var(--hard)", "var(--sage)", "var(--error)"];
  const stripHtml = (str: string) => str.replace(/<[^>]*>/g, "");

  const filtered = cards.filter((c) => {
    if (filterTag && !(c.tags ?? []).includes(filterTag)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const matchesTags = (c.tags ?? []).some((t) => t.toLowerCase().includes(q));
    return stripHtml(c.front).toLowerCase().includes(q) || stripHtml(c.back).toLowerCase().includes(q) || matchesTags;
  });

  const dueCount = cards.filter((c) => new Date(c.due) <= new Date()).length;

  if (loading) return <div className="text-[var(--slate)] text-center py-12">Chargement...</div>;
  if (!deck) return <div className="text-[var(--error)] text-center py-12">Deck introuvable</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-playfair-display)] text-3xl font-bold flex items-center gap-3">
            <span className="w-4 h-4 rounded-full inline-block shrink-0" style={{ background: deck.color }} />
            {deck.name}
          </h1>
          {deck.description && (
            <p className="text-[var(--slate)] mt-1">{deck.description}</p>
          )}
          <div className="flex gap-4 mt-2 text-sm text-[var(--slate)]">
            <span>{cards.length} carte{cards.length > 1 ? "s" : ""}</span>
            {dueCount > 0 && (
              <span className="text-[var(--gold)]">{dueCount} à réviser</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {dueCount > 0 && (
            <GoldButton onClick={() => router.push(`/review/${id}`)} className="text-xs py-2 px-4">
              Réviser
            </GoldButton>
          )}
          <GoldButton onClick={() => { setAddOpen(true); setFront(""); setBack(""); }} className="text-xs py-2 px-4">
            + Carte
          </GoldButton>
          <button
            onClick={() => setShowCreateSub(true)}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--gold)] text-[var(--gold)] hover:bg-[rgba(201,165,82,0.1)] transition-colors"
          >
            + Sous-deck
          </button>
          <button
            onClick={exportDeck}
            disabled={cards.length === 0}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--slate)] text-[var(--slate)] hover:text-[var(--white)] hover:border-[var(--white)] transition-colors disabled:opacity-40"
          >
            Exporter .apkg
          </button>
          <label className="px-3 py-2 text-xs rounded-lg border border-[var(--slate)] text-[var(--slate)] hover:text-[var(--white)] hover:border-[var(--white)] transition-colors cursor-pointer">
            {importing ? "Import..." : "Importer .apkg"}
            <input
              type="file"
              accept=".apkg"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFromApkg(file);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => { if (confirm("Réinitialiser TOUTES les cartes ?")) resetAll(); }}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--hard)] text-[var(--hard)] hover:bg-[var(--hard)] hover:text-[var(--navy)] transition-colors"
          >
            Tout réinitialiser
          </button>
          <button
            onClick={() => { if (confirm("Supprimer ce deck et toutes ses cartes ?")) deleteDeck(); }}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-[var(--navy)] transition-colors"
          >
            Supprimer deck
          </button>
        </div>
      </div>

      {/* Sub-decks */}
      {subDecks.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs text-[var(--slate)] uppercase tracking-wider mb-2">Sous-decks</h3>
          <div className="flex gap-2 flex-wrap">
            {subDecks.map((sd) => (
              <a
                key={sd.id}
                href={`/decks/${sd.id}`}
                className="card-hover px-4 py-2 flex items-center gap-2 text-sm hover:border-[var(--gold)]"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: sd.color }} />
                {sd.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setFilterTag(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              !filterTag ? "bg-[var(--gold)] text-[var(--navy)]" : "bg-[rgba(201,165,82,0.1)] text-[var(--slate)] hover:text-[var(--white)]"
            }`}
          >
            Toutes
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                filterTag === tag ? "bg-[var(--gold)] text-[var(--navy)]" : "bg-[rgba(201,165,82,0.1)] text-[var(--slate)] hover:text-[var(--white)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {cards.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--slate)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeWidth="2" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les cartes..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--navy-light)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
          />
        </div>
      )}

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-[var(--navy-light)] border border-[rgba(201,165,82,0.2)] flex items-center justify-between gap-4 animate-fade-slide">
          <span className="text-sm">
            <strong className="text-[var(--gold)]">{selected.size}</strong> carte{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={resetSelected}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--hard)] text-[var(--hard)] hover:bg-[var(--hard)] hover:text-[var(--navy)] transition-colors"
            >
              Réinitialiser
            </button>
            <button
              onClick={() => { if (confirm(`Supprimer ${selected.size} carte(s) ?`)) deleteSelected(); }}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-[var(--navy)] transition-colors"
            >
              Supprimer
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs rounded-lg text-[var(--slate)] hover:text-[var(--white)] transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Card list */}
      {cards.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-[var(--slate)]">Aucune carte. Ajoute ta première !</p>
        </Card>
      ) : (
        <>
          {/* Select all header */}
          {filtered.length > 1 && (
            <div className="flex items-center gap-3 mb-2 px-1">
              <button
                onClick={toggleSelectAll}
                className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center text-[10px] ${
                  selected.size === filtered.length
                    ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--navy)]"
                    : "border-[var(--slate)] hover:border-[var(--gold)]"
                }`}
              >
                {selected.size === filtered.length ? "✓" : ""}
              </button>
              <span className="text-[11px] text-[var(--slate)]">
                {selected.size === filtered.length ? "Tout désélectionner" : "Tout sélectionner"}
              </span>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className={`card-hover p-4 flex items-center gap-3 group transition-all ${
                  selected.has(c.id) ? "ring-1 ring-[var(--gold)] bg-[rgba(201,165,82,0.03)]" : ""
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(c.id)}
                  className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center text-[10px] shrink-0 ${
                    selected.has(c.id)
                      ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--navy)]"
                      : "border-[var(--navy-mid)] group-hover:border-[var(--slate)]"
                  }`}
                >
                  {selected.has(c.id) ? "✓" : ""}
                </button>

                {/* Content */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => openEdit(c)}
                >
                  <div className="font-medium truncate text-sm" dangerouslySetInnerHTML={{ __html: c.front }} />
                  <div className="text-xs text-[var(--slate)] truncate mt-0.5" dangerouslySetInnerHTML={{ __html: c.back }} />
                  {(c.tags ?? []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {c.tags.map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[rgba(201,165,82,0.15)] text-[var(--gold)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* State + actions */}
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      color: stateColors[c.state],
                      background: `${stateColors[c.state]}15`,
                    }}
                  >
                    {stateLabels[c.state] ?? "?"}
                  </span>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs text-[var(--slate)] hover:text-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Modifier"
                  >
                    ✎
                  </button>
                </div>
              </div>
            ))}
            {search && filtered.length === 0 && (
              <p className="text-[var(--slate)] text-sm text-center py-4">
                Aucune carte trouvée pour &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </>
      )}

      {/* Add modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter une carte">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--gold)] mb-1 block uppercase tracking-wider font-semibold">Recto</label>
            <RichTextEditor value={front} onChange={setFront} placeholder="Question..." autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Verso</label>
            <RichTextEditor value={back} onChange={setBack} placeholder="Réponse..." />
          </div>
          <GoldButton onClick={addCard} fullWidth>
            Ajouter
          </GoldButton>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editCard} onClose={() => setEditCard(null)} title="Modifier la carte">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[var(--gold)] mb-1 block uppercase tracking-wider font-semibold">Recto</label>
            <RichTextEditor value={front} onChange={setFront} placeholder="Question..." autoFocus />
          </div>
          <div>
            <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Verso</label>
            <RichTextEditor value={back} onChange={setBack} placeholder="Réponse..." />
          </div>
          <div>
            <label className="text-[10px] text-[var(--slate)] mb-1 block uppercase tracking-wider">Tags</label>
            <TagInput tags={editTags} onChange={setEditTags} allTags={allTags} />
          </div>
          <GoldButton onClick={saveEdit} fullWidth>
            Sauvegarder
          </GoldButton>
        </div>
      </Modal>

      {/* Create sub-deck modal */}
      <Modal open={showCreateSub} onClose={() => setShowCreateSub(false)} title="Créer un sous-deck">
        <div className="space-y-3">
          <input
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            placeholder="Nom du sous-deck"
            onKeyDown={(e) => { if (e.key === "Enter") createSubDeck(); }}
            className="w-full px-4 py-3 bg-[var(--navy)] border border-[var(--navy-mid)] rounded-lg text-[var(--white)] text-sm placeholder-[var(--slate)]"
            autoFocus
          />
          <GoldButton onClick={createSubDeck} fullWidth disabled={!subName.trim()}>
            Créer
          </GoldButton>
        </div>
      </Modal>
    </div>
  );
}
